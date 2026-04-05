import * as v from 'valibot'
import { computed, readonly, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import {
  readConfirmedTodosResumeState,
  subscribeToConfirmedTodosTruncate,
} from '@/db/confirmed-todos'
import {
  ACTIVE_PENDING_MUTATION_STATUSES,
  type PendingMutationLocalStatus,
} from '@/lib/pending-mutation-storage'

import { useTodoData } from './useTodoData.ts'
import { useTodoMutations } from './useTodoMutations.ts'

export type TodoSyncStatus = 'paused' | 'synced'
export type TodoDegradedStatus =
  | 'none'
  | 'retryable-error'
  | 'requires-reauth'
  | 'invariant-violation'

type TodoSyncState = {
  canRetrySync: ComputedRef<boolean>
  degradedStatus: ComputedRef<TodoDegradedStatus>
  hasPendingMutations: ComputedRef<boolean>
  isSyncing: Readonly<Ref<boolean>>
  syncStatus: ComputedRef<TodoSyncStatus>
  syncTodos: () => Promise<boolean>
}

const activePendingMutationStatusSchema = v.picklist(ACTIVE_PENDING_MUTATION_STATUSES)
const retryableWorkPendingMutationStatusSchema = v.picklist(['queued', 'retryable-error'] as const)
const retryableErrorPendingMutationStatusSchema = v.picklist(['retryable-error'] as const)
const degradedPendingMutationStatusSchema = v.picklist([
  'quarantined',
  'invariant-violation',
] as const)

function hasRetryablePendingWork(statuses: readonly PendingMutationLocalStatus[]) {
  return statuses.some((status) => v.is(retryableWorkPendingMutationStatusSchema, status))
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

let sharedTodoSync: TodoSyncState | null = null

export function useTodoSync(): TodoSyncState {
  if (sharedTodoSync) {
    return sharedTodoSync
  }

  const todoData = useTodoData()
  const { flushPendingMutations } = useTodoMutations()
  const isSyncing = ref(false)
  const isAwaitingResetRefetchBaseline = ref(readConfirmedTodosResumeState()?.kind === 'reset')
  let awaitResetRefetchBaselinePromise: Promise<void> | null = null

  const pendingStatuses = computed(() =>
    todoData.sync.controller.pendingMutations.value.map((entry) => entry.status),
  )
  const hasPendingMutations = computed(() =>
    pendingStatuses.value.some((status) => v.is(activePendingMutationStatusSchema, status)),
  )
  const degradedStatus = computed<TodoDegradedStatus>(() => {
    if (todoData.sync.controller.transportState.value.requiresReauth) {
      return 'requires-reauth'
    }

    if (
      todoData.sync.controller.transportState.value.hasInvariantViolations ||
      pendingStatuses.value.some((status) => v.is(degradedPendingMutationStatusSchema, status))
    ) {
      return 'invariant-violation'
    }

    if (
      pendingStatuses.value.some((status) =>
        v.is(retryableErrorPendingMutationStatusSchema, status),
      )
    ) {
      return 'retryable-error'
    }

    return 'none'
  })
  const syncStatus = computed<TodoSyncStatus>(() => {
    if (
      !todoData.sync.controller.transportState.value.canSend ||
      !todoData.connectivity.isReady.value ||
      degradedStatus.value !== 'none' ||
      hasRetryablePendingWork(pendingStatuses.value)
    ) {
      return 'paused'
    }

    return 'synced'
  })
  const canRetrySync = computed(
    () =>
      todoData.sync.controller.transportState.value.canSend &&
      degradedStatus.value !== 'requires-reauth' &&
      degradedStatus.value !== 'invariant-violation' &&
      hasRetryablePendingWork(pendingStatuses.value) &&
      !isSyncing.value,
  )

  async function syncTodos() {
    if (!todoData.sync.controller.transportState.value.canSend || isSyncing.value) {
      return false
    }

    isSyncing.value = true

    try {
      return await flushPendingMutations()
    } finally {
      isSyncing.value = false
    }
  }

  void Promise.resolve().then(() => {
    if (
      todoData.connectivity.isReady.value &&
      todoData.sync.controller.transportState.value.canSend &&
      hasPendingMutations.value
    ) {
      void syncTodos()
    }
  })

  async function reconcileAfterResetRefetchWhenReady() {
    if (awaitResetRefetchBaselinePromise) {
      return awaitResetRefetchBaselinePromise
    }

    awaitResetRefetchBaselinePromise = (async () => {
      while (isAwaitingResetRefetchBaseline.value) {
        if (readConfirmedTodosResumeState()?.kind === 'resume') {
          todoData.sync.controller.reconcileWithConfirmedTodos(
            todoData.readModel.confirmedTodos.value,
            {
              afterResetRefetch: true,
            },
          )
          isAwaitingResetRefetchBaseline.value = false
          return
        }

        await sleep(25)
      }
    })().finally(() => {
      awaitResetRefetchBaselinePromise = null
    })

    return awaitResetRefetchBaselinePromise
  }

  subscribeToConfirmedTodosTruncate(() => {
    isAwaitingResetRefetchBaseline.value = true
    void reconcileAfterResetRefetchWhenReady()
  })

  if (isAwaitingResetRefetchBaseline.value) {
    void reconcileAfterResetRefetchWhenReady()
  }

  watch(
    () => todoData.readModel.confirmedTodos.value,
    (confirmedTodos) => {
      todoData.sync.controller.reconcileWithConfirmedTodos(confirmedTodos)
    },
    { immediate: true },
  )

  watch(
    () => ({
      canSend: todoData.sync.controller.transportState.value.canSend,
      isReady: todoData.connectivity.isReady.value,
      pendingStatuses: pendingStatuses.value.join('|'),
    }),
    ({ canSend, isReady }) => {
      if (!canSend || !isReady || !hasPendingMutations.value || isSyncing.value) {
        return
      }

      void syncTodos()
    },
  )

  sharedTodoSync = {
    canRetrySync,
    degradedStatus,
    hasPendingMutations,
    isSyncing: readonly(isSyncing),
    syncStatus,
    syncTodos,
  }

  return sharedTodoSync
}
