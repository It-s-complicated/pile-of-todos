import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { useTodoData } from './useTodoData.ts'

type TodoSyncStatus = 'awaiting-confirmation' | 'paused' | 'queued-offline' | 'syncing' | 'synced'
type TodoDegradedStatus = 'none' | 'requires-reauth' | 'retryable-error'

type TodoSyncState = {
  acceptedMutationCount: ComputedRef<number>
  canRetrySync: ComputedRef<boolean>
  degradedStatus: ComputedRef<TodoDegradedStatus>
  hasPendingMutations: ComputedRef<boolean>
  isSyncing: Readonly<Ref<boolean>>
  pendingMutationCount: ComputedRef<number>
  queuedMutationCount: ComputedRef<number>
  syncStatus: ComputedRef<TodoSyncStatus>
  syncTodos: () => Promise<boolean>
}

let sharedTodoSync: TodoSyncState | null = null

export function useTodoSync(): TodoSyncState {
  if (sharedTodoSync) {
    return sharedTodoSync
  }

  const todoData = useTodoData()
  const queuedMutationCount = computed(() => todoData.sync.controller.queuedMutationCount.value)
  const acceptedMutationCount = computed(() => todoData.sync.controller.acceptedMutationCount.value)
  const pendingMutationCount = computed(() => todoData.sync.controller.pendingMutationCount.value)
  const hasPendingMutations = computed(() => pendingMutationCount.value > 0)
  const degradedStatus = computed<TodoDegradedStatus>(() => {
    if (todoData.sync.controller.transportState.value.requiresReauth) {
      return 'requires-reauth'
    }

    if (todoData.sync.controller.lastErrorKind.value === 'retryable') {
      return 'retryable-error'
    }

    return 'none'
  })
  const syncStatus = computed<TodoSyncStatus>(() => {
    if (queuedMutationCount.value > 0 && !todoData.connectivity.isOnline.value) {
      return 'queued-offline'
    }

    if (todoData.sync.controller.isFlushing.value) {
      return 'syncing'
    }

    if (acceptedMutationCount.value > 0 && degradedStatus.value === 'none') {
      return 'awaiting-confirmation'
    }

    if (
      !todoData.connectivity.isReady.value ||
      !todoData.sync.controller.transportState.value.canFlush ||
      degradedStatus.value !== 'none'
    ) {
      return 'paused'
    }

    return 'synced'
  })
  const canRetrySync = computed(
    () =>
      todoData.sync.controller.transportState.value.canFlush &&
      pendingMutationCount.value > 0 &&
      !todoData.sync.controller.isFlushing.value,
  )

  async function syncTodos() {
    if (
      !todoData.sync.controller.transportState.value.canFlush ||
      todoData.sync.controller.isFlushing.value
    ) {
      return false
    }

    return todoData.sync.controller.flushPendingMutations()
  }

  sharedTodoSync = {
    acceptedMutationCount,
    canRetrySync,
    degradedStatus,
    hasPendingMutations,
    isSyncing: todoData.sync.controller.isFlushing,
    pendingMutationCount,
    queuedMutationCount,
    syncStatus,
    syncTodos,
  }

  return sharedTodoSync
}
