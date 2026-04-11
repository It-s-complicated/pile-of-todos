import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { useTodoData } from './useTodoData.ts'

type TodoSyncStatus = 'paused' | 'queued-offline' | 'syncing' | 'synced'
type TodoDegradedStatus = 'none' | 'retryable-error' | 'requires-reauth'

type TodoSyncState = {
  canRetrySync: ComputedRef<boolean>
  degradedStatus: ComputedRef<TodoDegradedStatus>
  hasPendingMutations: ComputedRef<boolean>
  isSyncing: Readonly<Ref<boolean>>
  queuedCreateCount: ComputedRef<number>
  syncStatus: ComputedRef<TodoSyncStatus>
  syncTodos: () => Promise<boolean>
}

let sharedTodoSync: TodoSyncState | null = null

export function useTodoSync(): TodoSyncState {
  if (sharedTodoSync) {
    return sharedTodoSync
  }

  const todoData = useTodoData()
  const queuedCreateCount = computed(() => todoData.sync.controller.queuedCreateCount.value)
  const hasPendingMutations = computed(() => queuedCreateCount.value > 0)
  const degradedStatus = computed<TodoDegradedStatus>(() => {
    if (todoData.sync.controller.transportState.value.requiresReauth) {
      return 'requires-reauth'
    }

    if (queuedCreateCount.value > 0 && todoData.sync.controller.lastError.value) {
      return 'retryable-error'
    }

    return 'none'
  })
  const syncStatus = computed<TodoSyncStatus>(() => {
    if (queuedCreateCount.value > 0 && !todoData.connectivity.isOnline.value) {
      return 'queued-offline'
    }

    if (
      queuedCreateCount.value > 0 &&
      todoData.sync.controller.transportState.value.canFlush &&
      degradedStatus.value === 'none'
    ) {
      return 'syncing'
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
      queuedCreateCount.value > 0 &&
      !todoData.sync.controller.isFlushing.value,
  )

  async function syncTodos() {
    if (
      !todoData.sync.controller.transportState.value.canFlush ||
      todoData.sync.controller.isFlushing.value
    ) {
      return false
    }

    return todoData.sync.controller.flushQueuedCreates()
  }

  sharedTodoSync = {
    canRetrySync,
    degradedStatus,
    hasPendingMutations,
    isSyncing: todoData.sync.controller.isFlushing,
    queuedCreateCount,
    syncStatus,
    syncTodos,
  }

  return sharedTodoSync
}
