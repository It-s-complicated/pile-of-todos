import { computed, readonly, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { getCurrentDeviceId } from '@/db/collections'
import type { Todo } from '@/db/collections'
import { getSupabaseClient, setSupabaseAuthError } from '@/lib/supabase'
import {
  buildTodoMutationIntent,
  shouldWriteTodoToRemote,
  submitTodoMutation,
} from '@/lib/todo-sync'
import { useAuth } from './useAuth'
import { useTodoData } from './useTodoData'

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local-only' | 'stale'

function isSameTodo(left: Todo, right: Todo) {
  return (
    left.label === right.label &&
    left.weekNumber === right.weekNumber &&
    left.done === right.done &&
    left.archived === right.archived &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.deviceId === right.deviceId &&
    left.userId === right.userId &&
    left.deletedAt === right.deletedAt
  )
}

function shouldRemoteWin(localTodo: Todo, remoteTodo: Todo) {
  return (
    remoteTodo.updatedAt > localTodo.updatedAt ||
    (remoteTodo.updatedAt === localTodo.updatedAt && !isSameTodo(remoteTodo, localTodo))
  )
}

function getPushFingerprint(localTodosToPush: Todo[]) {
  return localTodosToPush
    .map((todo) => `${todo.id}:${todo.updatedAt}:${todo.deletedAt ?? 'active'}`)
    .join('|')
}

type TodoSyncState = {
  canRetrySync: ComputedRef<boolean>
  hasSyncedOnce: ComputedRef<boolean>
  isRemoteReady: ComputedRef<boolean>
  isSyncing: Readonly<Ref<boolean>>
  lastSyncedAt: ComputedRef<number | null>
  needsSync: ComputedRef<boolean>
  status: ComputedRef<SyncStatus>
  syncError: ComputedRef<boolean>
  syncTodos: () => Promise<boolean>
}

let sharedTodoSync: TodoSyncState | null = null
let lastPushedFingerprintByUser: Record<string, string> = {}
let syncQueued = false

export function useTodoSync(): TodoSyncState {
  if (sharedTodoSync) {
    return sharedTodoSync
  }

  const { accessState, signOut } = useAuth()
  const todoData = useTodoData()

  const isSyncing = ref(false)
  const syncErrorUserId = ref<string | null>(null)
  const lastSyncedAtByUser = ref<Record<string, number>>({})

  const isRemoteReady = computed(
    () => todoData.syncInputs.canSync.value && todoData.syncInputs.isRemoteQueryReady.value,
  )
  const syncError = computed(
    () =>
      todoData.auth.activeUserId.value !== null &&
      syncErrorUserId.value === todoData.auth.activeUserId.value,
  )
  const lastSyncedAt = computed(() =>
    todoData.auth.activeUserId.value === null
      ? null
      : (lastSyncedAtByUser.value[todoData.auth.activeUserId.value] ?? null),
  )
  const hasSyncedOnce = computed(() => lastSyncedAt.value !== null)
  const needsSync = computed(() => {
    if (!todoData.syncInputs.canSync.value) {
      return false
    }

    if (syncError.value) {
      return true
    }

    if (!isRemoteReady.value) {
      return true
    }

    return todoData.syncInputs.pendingLocalTodos.value.length > 0
  })
  const status = computed<SyncStatus>(() => {
    if (
      !todoData.connectivity.isOnline.value ||
      !todoData.connectivity.isElectricEnabled ||
      !todoData.auth.activeUserId.value ||
      !todoData.auth.isAuthReady.value
    ) {
      return 'local-only'
    }

    if (todoData.guestClaim.visible.value) {
      return 'local-only'
    }

    if (isSyncing.value || !isRemoteReady.value) {
      return 'syncing'
    }

    if (syncError.value) {
      return hasSyncedOnce.value ? 'stale' : 'error'
    }

    if (needsSync.value) {
      return 'syncing'
    }

    return hasSyncedOnce.value ? 'synced' : 'syncing'
  })
  const canRetrySync = computed(
    () => needsSync.value && !isSyncing.value && !todoData.guestClaim.visible.value,
  )

  function applyRemoteTodoToLocal(todo: Todo) {
    const collection = todoData.collections.activeLocal.value
    const existing = collection.get(todo.id)

    if (!existing) {
      collection.insert(todo)
      return
    }

    collection.update(todo.id, (draft) => {
      draft.label = todo.label
      draft.weekNumber = todo.weekNumber
      draft.done = todo.done
      draft.archived = todo.archived
      draft.createdAt = todo.createdAt
      draft.updatedAt = todo.updatedAt
      draft.deviceId = todo.deviceId
      draft.userId = todo.userId
      draft.deletedAt = todo.deletedAt
    })
  }

  async function reconcileRemoteTodos(remoteTodosToApply: Todo[]) {
    const localById = new Map(todoData.snapshots.local.value.map((todo) => [todo.id, todo]))

    for (const remoteTodo of remoteTodosToApply) {
      const localTodo = localById.get(remoteTodo.id)

      if (!localTodo) {
        applyRemoteTodoToLocal(remoteTodo)
        continue
      }

      if (shouldRemoteWin(localTodo, remoteTodo)) {
        applyRemoteTodoToLocal(remoteTodo)
      }
    }
  }

  async function pushLocalTodos(
    localTodosToPush: Todo[],
    remoteTodosToCompare: Todo[],
    activeUserId: string,
  ) {
    const remoteById = new Map(remoteTodosToCompare.map((todo) => [todo.id, todo]))
    const pushableTodos = localTodosToPush.filter((todo) =>
      shouldWriteTodoToRemote(todo, remoteById.get(todo.id), activeUserId),
    )

    if (pushableTodos.length === 0) {
      return []
    }

    const supabase = getSupabaseClient()

    if (!supabase) {
      throw new Error('Cloud sync is not configured: missing Supabase credentials')
    }

    const pushFingerprint = getPushFingerprint(pushableTodos)

    if (pushFingerprint === lastPushedFingerprintByUser[activeUserId]) {
      return []
    }

    const acceptedMutations = []
    const acceptedIds = new Set<string>()

    for (const todo of pushableTodos) {
      const intent = buildTodoMutationIntent({
        todo,
        remoteTodo: remoteById.get(todo.id),
        activeUserId,
        fallbackDeviceId: getCurrentDeviceId(),
      })
      const acceptedMutation = await submitTodoMutation(supabase, intent)

      acceptedIds.add(todo.id)
      acceptedMutations.push(acceptedMutation)
    }

    // Only commit fingerprint when ALL mutations were accepted.
    // If any RPC call throws mid-batch, fingerprint stays unchanged so the
    // next sync will retry the full batch (idempotent for already-accepted todos).
    if (acceptedIds.size === pushableTodos.length) {
      lastPushedFingerprintByUser = {
        ...lastPushedFingerprintByUser,
        [activeUserId]: pushFingerprint,
      }
    }

    return acceptedMutations
  }

  async function syncTodos() {
    const activeUserId = todoData.auth.activeUserId.value

    if (!todoData.syncInputs.canSync.value || !activeUserId) {
      return false
    }

    if (isSyncing.value) {
      syncQueued = true
      return false
    }

    isSyncing.value = true
    syncErrorUserId.value = null

    try {
      await reconcileRemoteTodos(todoData.snapshots.remoteForActiveUser.value)
      await pushLocalTodos(
        todoData.syncInputs.pendingLocalTodos.value,
        todoData.snapshots.remoteForActiveUser.value,
        activeUserId,
      )

      lastSyncedAtByUser.value = {
        ...lastSyncedAtByUser.value,
        [activeUserId]: Date.now(),
      }
      syncErrorUserId.value = null

      return todoData.syncInputs.pendingLocalTodos.value.length === 0
    } catch (error) {
      console.error('Sync failed:', error)
      syncErrorUserId.value = activeUserId
      return false
    } finally {
      isSyncing.value = false

      if (syncQueued) {
        syncQueued = false
        void syncTodos()
      }
    }
  }

  watch(
    () => accessState.value,
    (nextAccessState) => {
      if (nextAccessState !== 'denied') {
        return
      }

      setSupabaseAuthError('This GitHub account is not approved for sync access.')
      void signOut()
    },
  )

  watch(
    () => todoData.syncInputs.syncPlan.value,
    (plan, previousPlan) => {
      if (!plan) {
        return
      }

      if (
        previousPlan &&
        previousPlan.activeUserId === plan.activeUserId &&
        previousPlan.remoteFingerprint !== plan.remoteFingerprint
      ) {
        lastPushedFingerprintByUser = {
          ...lastPushedFingerprintByUser,
          [plan.activeUserId]: '',
        }
      }

      void syncTodos()
    },
  )

  sharedTodoSync = {
    canRetrySync,
    hasSyncedOnce,
    isRemoteReady,
    isSyncing: readonly(isSyncing),
    lastSyncedAt,
    needsSync,
    status,
    syncError,
    syncTodos,
  }
  return sharedTodoSync
}
