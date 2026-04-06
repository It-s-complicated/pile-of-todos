import { computed, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { getCurrentDeviceId, type Todo } from '@/db/collections'
import {
  createOfflineTodoCreateQueue,
  getOfflineTodoCreatePartitionKey,
} from '@/lib/offline-todo-create-queue'
import type { QueuedTodoCreateEntry } from '@/lib/offline-todo-create-queue'
import { getSupabaseClient } from '@/lib/supabase'
import { TodoRemoteWriteError, buildRemoteTodoRow, upsertRemoteTodo } from '@/lib/todo-sync'

import { useAuth } from './useAuth'
import { useNetworkStatus } from './useNetworkStatus'

type UseTodoCreateQueueControllerOptions = {
  auth?: {
    accessState: Ref<ReturnType<typeof useAuth>['accessState']['value']>
    authVersion?: Ref<string | null>
    isAuthReady: Ref<boolean>
    userId: Ref<string | null>
  }
  network?: {
    isOnline: Ref<boolean>
  }
  storage?: ReturnType<typeof createOfflineTodoCreateQueue>
  writeClient?: Pick<ReturnType<typeof getSupabaseClient>, 'rpc'>
}

let sharedTodoCreateQueueController: ReturnType<typeof createTodoCreateQueueController> | null =
  null

function createTodoCreateQueueController(options: UseTodoCreateQueueControllerOptions = {}) {
  const defaultAuth = useAuth()
  const auth = options.auth ?? defaultAuth
  const network = options.network ?? useNetworkStatus()
  const storage = options.storage ?? createOfflineTodoCreateQueue()
  const writeClient = options.writeClient ?? getSupabaseClient()
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
  const isFlushing = ref(false)
  const queuedCreates = ref<QueuedTodoCreateEntry[]>([])

  const activeUserId = computed(() =>
    auth.accessState.value === 'approved' ? auth.userId.value : null,
  )
  const activePartitionKey = computed(() => getOfflineTodoCreatePartitionKey(activeUserId.value))
  const canFlush = computed(
    () =>
      network.isOnline.value &&
      auth.isAuthReady.value &&
      auth.accessState.value === 'approved' &&
      activeUserId.value !== null &&
      !requiresReauth.value,
  )
  const transportState = computed(() => ({
    canFlush: canFlush.value,
    isAuthReady: auth.isAuthReady.value,
    isOnline: network.isOnline.value,
    requiresReauth: requiresReauth.value,
  }))

  function reloadQueuedCreates() {
    if (!activeUserId.value) {
      queuedCreates.value = []
      return
    }

    queuedCreates.value = storage.list(activePartitionKey.value)
  }

  function clearSyncError() {
    lastError.value = null
  }

  function markRequiresReauth(message: string) {
    requiresReauth.value = true
    lastError.value = message
  }

  function markRetryableError(message: string) {
    lastError.value = message
  }

  function queueCreate(todo: Todo) {
    if (!activeUserId.value) {
      throw new Error('Cannot queue a todo create without an approved account')
    }

    storage.save({
      partitionKey: activePartitionKey.value,
      queuedAt: Date.now(),
      todo,
      updatedAt: Date.now(),
    })
    reloadQueuedCreates()
  }

  async function flushQueuedCreates() {
    if (!canFlush.value || isFlushing.value || !activeUserId.value) {
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
          reloadQueuedCreates()
          return true
        }

        try {
          await upsertRemoteTodo(
            writeClient,
            buildRemoteTodoRow(nextEntry.todo, flushingUserId, getCurrentDeviceId()),
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to flush queued todo'

          if (error instanceof TodoRemoteWriteError && error.kind === 'auth') {
            markRequiresReauth(message)
            return false
          }

          lastError.value = message
          reloadQueuedCreates()
          return false
        }

        storage.remove(flushingPartitionKey, nextEntry.todo.id)

        if (
          activePartitionKey.value !== flushingPartitionKey ||
          activeUserId.value !== flushingUserId
        ) {
          reloadQueuedCreates()
          return false
        }

        clearSyncError()
        reloadQueuedCreates()
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
      const refreshedApprovedSessionForSameUser =
        nextAuthState.accessState === 'approved' &&
        nextAuthState.userId !== null &&
        nextAuthState.userId === previousAuthState.userId &&
        nextAuthState.authVersion !== null &&
        nextAuthState.authVersion !== previousAuthState.authVersion

      if (authIdentityChanged || refreshedApprovedSessionForSameUser) {
        requiresReauth.value = false
      }
    },
    { immediate: true },
  )

  watch(activePartitionKey, reloadQueuedCreates, { immediate: true })

  watch(
    () => ({
      canFlush: canFlush.value,
      queuedTodoIds: queuedCreates.value.map((entry) => entry.todo.id).join('|'),
    }),
    ({ canFlush, queuedTodoIds }) => {
      if (!canFlush || queuedTodoIds.length === 0 || isFlushing.value) {
        return
      }

      void flushQueuedCreates()
    },
    { immediate: true },
  )

  return {
    activePartitionKey,
    clearSyncError,
    flushQueuedCreates,
    isFlushing: readonly(isFlushing),
    lastError: readonly(lastError),
    markRequiresReauth,
    markRetryableError,
    queuedCreateCount: computed(() => queuedCreates.value.length),
    queuedCreates: readonly(queuedCreates),
    queueCreate,
    reloadQueuedCreates,
    transportState,
  }
}

export function useTodoCreateQueueController(options: UseTodoCreateQueueControllerOptions = {}) {
  if (Object.keys(options).length > 0) {
    return createTodoCreateQueueController(options)
  }

  if (sharedTodoCreateQueueController) {
    return sharedTodoCreateQueueController
  }

  sharedTodoCreateQueueController = createTodoCreateQueueController()
  return sharedTodoCreateQueueController
}
