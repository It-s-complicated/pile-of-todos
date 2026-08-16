import { computed, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { getCurrentDeviceId } from '@/db/collections'
import { refreshConfirmedTodos } from '@/db/confirmed-todos'
import {
  createOfflineTodoMutationQueue,
  getOfflineTodoMutationPartitionKey,
  type QueuedTodoMutation,
  type QueuedTodoMutationEntry,
} from '@/lib/offline-todo-mutation-queue'
import { getSupabaseClient } from '@/lib/supabase'
import {
  TodoRemoteWriteError,
  buildRemoteTodoRow,
  updateRemoteTodo,
  upsertRemoteTodo,
} from '@/lib/todo-sync'

import { useAuth } from './useAuth'
import { useNetworkStatus } from './useNetworkStatus'

type QueueErrorKind = 'none' | 'requires-reauth' | 'retryable'

const MAX_AUTO_FLUSH_ATTEMPTS = 5
const RETRY_BASE_DELAY_MS = 1_000

type UseTodoMutationQueueControllerOptions = {
  auth?: {
    accessState: Ref<ReturnType<typeof useAuth>['accessState']['value']>
    authVersion?: Ref<string | null>
    isAuthReady: Ref<boolean>
    userId: Ref<string | null>
  }
  network?: {
    isOnline: Ref<boolean>
  }
  refreshConfirmedTodos?: () => Promise<void>
  storage?: ReturnType<typeof createOfflineTodoMutationQueue>
  writeClient?: Pick<ReturnType<typeof getSupabaseClient>, 'rpc'>
}

let sharedTodoMutationQueueController: ReturnType<typeof createTodoMutationQueueController> | null =
  null

function getQueueErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function acceptQueuedMutation(
  entry: QueuedTodoMutationEntry,
  activeUserId: string,
  writeClient: Pick<ReturnType<typeof getSupabaseClient>, 'rpc'>,
) {
  switch (entry.mutation.kind) {
    case 'create':
      return upsertRemoteTodo(
        writeClient,
        buildRemoteTodoRow(
          entry.mutation.optimisticTodo,
          activeUserId,
          entry.mutation.optimisticTodo.deviceId ?? getCurrentDeviceId(),
        ),
        {
          mutationId: entry.mutation.mutationId,
        },
      )
    case 'delete':
      return updateRemoteTodo(writeClient, {
        activeUserId,
        kind: 'delete',
        mutationId: entry.mutation.mutationId,
        todoId: entry.mutation.todoId,
        updates: {
          deletedAt: entry.mutation.updates.deletedAt,
          deviceId: entry.mutation.optimisticTodo.deviceId,
          updatedAt: entry.mutation.updates.updatedAt,
        },
      })
    case 'update':
      return updateRemoteTodo(writeClient, {
        activeUserId,
        mutationId: entry.mutation.mutationId,
        todoId: entry.mutation.todoId,
        updates: {
          ...entry.mutation.updates,
          deviceId: entry.mutation.optimisticTodo.deviceId,
        },
      })
  }
}

function createTodoMutationQueueController(options: UseTodoMutationQueueControllerOptions = {}) {
  const defaultAuth = useAuth()
  const auth = options.auth ?? defaultAuth
  const network = options.network ?? useNetworkStatus()
  const storage = options.storage ?? createOfflineTodoMutationQueue()
  const writeClient = options.writeClient ?? getSupabaseClient()
  const refreshSnapshot = options.refreshConfirmedTodos ?? refreshConfirmedTodos
  const authVersion =
    options.auth?.authVersion ??
    computed(() => {
      const session = defaultAuth.session?.value

      if (!session) {
        return null
      }

      return `${session.access_token}:${String(session.expires_at ?? 'no-expiry')}`
    })

  const requiresReauth = ref(false)
  const lastError = ref<string | null>(null)
  const lastErrorKind = ref<QueueErrorKind>('none')
  const isFlushing = ref(false)
  const pendingMutations = ref<QueuedTodoMutationEntry[]>([])
  let retryAttemptCount = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const activeUserId = computed(() =>
    auth.accessState.value === 'signed-in' ? auth.userId.value : null,
  )
  const activePartitionKey = computed(() =>
    activeUserId.value ? getOfflineTodoMutationPartitionKey(activeUserId.value) : null,
  )
  const canFlush = computed(
    () =>
      network.isOnline.value &&
      auth.isAuthReady.value &&
      auth.accessState.value === 'signed-in' &&
      activeUserId.value !== null &&
      !requiresReauth.value,
  )
  const queuedMutationCount = computed(
    () => pendingMutations.value.filter((entry) => entry.state === 'queued').length,
  )
  const acceptedMutationCount = computed(
    () => pendingMutations.value.filter((entry) => entry.state === 'accepted').length,
  )
  const pendingMutationCount = computed(() => pendingMutations.value.length)
  const transportState = computed(() => ({
    acceptedMutationCount: acceptedMutationCount.value,
    canFlush: canFlush.value,
    hasAcceptedPending: acceptedMutationCount.value > 0,
    hasQueuedPending: queuedMutationCount.value > 0,
    isAuthReady: auth.isAuthReady.value,
    isOnline: network.isOnline.value,
    lastErrorKind: lastErrorKind.value,
    requiresReauth: requiresReauth.value,
  }))

  function reloadPendingMutations() {
    if (!activePartitionKey.value) {
      pendingMutations.value = []
      return
    }

    pendingMutations.value = storage.list(activePartitionKey.value)
  }

  function cancelScheduledRetry() {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function clearSyncErrorState() {
    lastError.value = null
    lastErrorKind.value = 'none'
  }

  function clearSyncError() {
    cancelScheduledRetry()
    retryAttemptCount = 0
    clearSyncErrorState()
  }

  function markRequiresReauth(message: string) {
    cancelScheduledRetry()
    requiresReauth.value = true
    lastError.value = message
    lastErrorKind.value = 'requires-reauth'
  }

  function markRetryableError(message: string) {
    cancelScheduledRetry()
    lastError.value = message
    lastErrorKind.value = 'retryable'
    retryAttemptCount += 1

    if (retryAttemptCount >= MAX_AUTO_FLUSH_ATTEMPTS) {
      return
    }

    retryTimer = setTimeout(
      () => {
        retryTimer = null

        if (!canFlush.value) {
          return
        }

        clearSyncErrorState()
        void flushPendingMutations()
      },
      RETRY_BASE_DELAY_MS * 2 ** (retryAttemptCount - 1),
    )
  }

  function queueMutation(mutation: QueuedTodoMutation) {
    if (!activePartitionKey.value) {
      throw new Error('Cannot queue a todo mutation without a signed-in account')
    }

    storage.save({
      acceptedAt: null,
      partitionKey: activePartitionKey.value,
      mutation,
      queuedAt: Date.now(),
      state: 'queued',
      updatedAt: Date.now(),
    })
    clearSyncError()
    reloadPendingMutations()
  }

  async function confirmAcceptedMutation(entry: QueuedTodoMutationEntry, partitionKey: string) {
    await refreshSnapshot()
    storage.remove(partitionKey, entry.mutation.mutationId)
  }

  async function flushPendingMutations() {
    if (!canFlush.value || isFlushing.value || !activeUserId.value || !activePartitionKey.value) {
      return false
    }

    const flushingUserId = activeUserId.value
    const flushingPartitionKey = activePartitionKey.value
    isFlushing.value = true

    try {
      while (true) {
        const [nextEntry] = storage.list(flushingPartitionKey)

        if (!nextEntry) {
          clearSyncError()
          reloadPendingMutations()
          return true
        }

        try {
          if (nextEntry.state === 'queued') {
            await acceptQueuedMutation(nextEntry, flushingUserId, writeClient)

            storage.save({
              ...nextEntry,
              acceptedAt: Date.now(),
              state: 'accepted',
              updatedAt: Date.now(),
            })
          } else {
            await confirmAcceptedMutation(nextEntry, flushingPartitionKey)
          }
        } catch (error) {
          const message = getQueueErrorMessage(error, 'Unable to sync pending todo mutations')

          if (error instanceof TodoRemoteWriteError && error.kind === 'auth') {
            markRequiresReauth(message)
            reloadPendingMutations()
            return false
          }

          if (nextEntry.state === 'accepted') {
            markRetryableError(message)
            reloadPendingMutations()
            return false
          }

          markRetryableError(message)
          reloadPendingMutations()
          return false
        }

        if (
          activePartitionKey.value !== flushingPartitionKey ||
          activeUserId.value !== flushingUserId
        ) {
          reloadPendingMutations()
          return false
        }

        clearSyncError()
        reloadPendingMutations()
      }
    } finally {
      isFlushing.value = false
    }
  }

  watch(
    () => ({
      accessState: auth.accessState.value,
      authVersion: authVersion.value,
      userId: auth.userId.value,
    }),
    (nextAuthState, previousAuthState) => {
      if (!previousAuthState) {
        return
      }

      const authIdentityChanged =
        nextAuthState.accessState !== previousAuthState.accessState ||
        nextAuthState.userId !== previousAuthState.userId
      const refreshedSignedInSessionForSameUser =
        nextAuthState.accessState === 'signed-in' &&
        nextAuthState.userId !== null &&
        nextAuthState.userId === previousAuthState.userId &&
        nextAuthState.authVersion !== null &&
        nextAuthState.authVersion !== previousAuthState.authVersion

      if (authIdentityChanged || refreshedSignedInSessionForSameUser) {
        requiresReauth.value = false
        clearSyncError()
      }
    },
    { immediate: true },
  )

  watch(activePartitionKey, reloadPendingMutations, { immediate: true })

  watch(
    () => network.isOnline.value,
    (online, wasOnline) => {
      if (!online) {
        cancelScheduledRetry()
        return
      }

      if (wasOnline === false && lastErrorKind.value === 'retryable') {
        retryAttemptCount = 0
        clearSyncErrorState()
        void flushPendingMutations()
      }
    },
  )

  watch(
    () => ({
      canFlush: canFlush.value,
      pendingMutationKey: pendingMutations.value
        .map((entry) => `${entry.mutation.mutationId}:${entry.state}`)
        .join('|'),
    }),
    ({ canFlush, pendingMutationKey }) => {
      if (
        !canFlush ||
        pendingMutationKey.length === 0 ||
        isFlushing.value ||
        lastErrorKind.value !== 'none'
      ) {
        return
      }

      void flushPendingMutations()
    },
    { immediate: true },
  )

  return {
    acceptedMutationCount,
    activePartitionKey,
    clearSyncError,
    flushPendingMutations,
    isFlushing: readonly(isFlushing),
    lastError: readonly(lastError),
    lastErrorKind: readonly(lastErrorKind),
    markRequiresReauth,
    markRetryableError,
    pendingMutationCount,
    pendingMutations: readonly(pendingMutations),
    queueMutation,
    queuedMutationCount,
    reloadPendingMutations,
    transportState,
  }
}

export function useTodoMutationQueueController(
  options: UseTodoMutationQueueControllerOptions = {},
) {
  if (Object.keys(options).length > 0) {
    return createTodoMutationQueueController(options)
  }

  if (sharedTodoMutationQueueController) {
    return sharedTodoMutationQueueController
  }

  sharedTodoMutationQueueController = createTodoMutationQueueController()
  return sharedTodoMutationQueueController
}

export const useTodoCreateQueueController = useTodoMutationQueueController
