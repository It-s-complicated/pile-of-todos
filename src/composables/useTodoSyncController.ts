import { computed, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import {
  GUEST_PENDING_MUTATION_PARTITION,
  getPendingMutationPartitionKey,
  createPendingMutationStorage,
} from '@/lib/pending-mutation-storage'
import type {
  PendingMutationEntry,
  PendingMutationLocalStatus,
  PendingMutationReference,
} from '@/lib/pending-mutation-storage'
import type { TodoMutationResponse } from '@/lib/todo-mutation-contract'
import { reconcilePendingMutations } from '@/lib/todo-reconciliation'

import { useAuth } from './useAuth'
import { useNetworkStatus } from './useNetworkStatus'

type UseTodoSyncControllerOptions = {
  storage?: ReturnType<typeof createPendingMutationStorage>
  auth?: {
    accessState: Ref<ReturnType<typeof useAuth>['accessState']['value']>
    isAuthReady: Ref<boolean>
    userId: Ref<string | null>
  }
  network?: {
    isOnline: Ref<boolean>
  }
}

function getPendingMutationReference(entry: PendingMutationReference): PendingMutationReference {
  return {
    mutationId: entry.mutationId,
    partitionKey: entry.partitionKey,
  }
}

function isProtectedPendingMutationStatus(status: PendingMutationLocalStatus) {
  return status === 'quarantined' || status === 'invariant-violation'
}

export function useTodoSyncController(options: UseTodoSyncControllerOptions = {}) {
  const auth = options.auth ?? useAuth()
  const network = options.network ?? useNetworkStatus()
  const { accessState, isAuthReady, userId } = auth
  const { isOnline } = network
  const storage = options.storage ?? createPendingMutationStorage()
  const confirmedTxids = ref<Set<string>>(new Set())
  const pendingMutations = ref<PendingMutationEntry[]>([])

  const activeUserId = computed(() => (accessState.value === 'approved' ? userId.value : null))
  const activePartitionKey = computed(() => getPendingMutationPartitionKey(activeUserId.value))
  const requiresReauth = computed(
    () => isAuthReady.value && activeUserId.value === null && accessState.value === 'approved',
  )
  const hasInvariantViolations = computed(() =>
    pendingMutations.value.some((entry) => entry.status === 'invariant-violation'),
  )
  const canSend = computed(
    () =>
      isOnline.value &&
      isAuthReady.value &&
      accessState.value === 'approved' &&
      !requiresReauth.value,
  )
  const transportState = computed(() => ({
    canSend: canSend.value,
    hasInvariantViolations: hasInvariantViolations.value,
    isAuthReady: isAuthReady.value,
    isOnline: isOnline.value,
    requiresReauth: requiresReauth.value,
  }))

  function reloadPendingMutations() {
    pendingMutations.value = storage.list(activePartitionKey.value)
  }

  function writeEntry(nextEntry: PendingMutationEntry) {
    storage.save(nextEntry)
    reloadPendingMutations()
  }

  function updateMutationStatus(
    reference: PendingMutationReference,
    status: PendingMutationLocalStatus,
    fields: Partial<PendingMutationEntry> = {},
  ) {
    const currentEntry = storage.get(reference)

    if (!currentEntry) {
      throw new Error(
        `Pending mutation ${reference.mutationId} was not found in partition ${reference.partitionKey}`,
      )
    }

    const nextStatus = isProtectedPendingMutationStatus(currentEntry.status)
      ? currentEntry.status
      : status

    writeEntry({
      ...currentEntry,
      ...fields,
      updatedAt: fields.updatedAt ?? Date.now(),
      status: nextStatus,
    })
  }

  function recordPendingMutation(entry: PendingMutationEntry) {
    if (entry.partitionKey !== activePartitionKey.value) {
      throw new Error('Cannot record a pending mutation into a non-active partition')
    }

    writeEntry(entry)
    return getPendingMutationReference(entry)
  }

  function acceptMutation(
    reference: PendingMutationReference,
    accepted: TodoMutationResponse,
    now = Date.now(),
  ) {
    updateMutationStatus(reference, 'accepted-awaiting-sync', { accepted, updatedAt: now })
  }

  function markMutationSending(reference: PendingMutationReference, now = Date.now()) {
    updateMutationStatus(reference, 'sending', { updatedAt: now })
  }

  function markMutationRetryableError(
    reference: PendingMutationReference,
    errorMessage: string,
    now = Date.now(),
  ) {
    updateMutationStatus(reference, 'retryable-error', { errorMessage, updatedAt: now })
  }

  function markMutationRejected(
    reference: PendingMutationReference,
    errorMessage: string,
    now = Date.now(),
  ) {
    updateMutationStatus(reference, 'rejected', { errorMessage, updatedAt: now })
  }

  function confirmTxid(txid: string) {
    confirmedTxids.value = new Set([...confirmedTxids.value, txid])
  }

  function reconcileWithConfirmedTodos(
    confirmedTodos: Parameters<typeof reconcilePendingMutations>[0]['confirmedTodos'],
    options: { afterResetRefetch?: boolean; now?: number } = {},
  ) {
    const reconciledMutations = reconcilePendingMutations({
      confirmedTodos,
      pendingMutations: pendingMutations.value,
      confirmedTxids: confirmedTxids.value,
      afterResetRefetch: options.afterResetRefetch,
      now: options.now,
    })

    for (const mutation of reconciledMutations) {
      storage.save(mutation)
    }

    reloadPendingMutations()
  }

  function quarantineActivePartition(reason: 'user-switched', now = Date.now()) {
    storage.quarantinePartition({
      partitionKey: activePartitionKey.value,
      now,
      reason,
    })
    reloadPendingMutations()
  }

  watch(
    activePartitionKey,
    (nextPartitionKey, previousPartitionKey) => {
      if (
        previousPartitionKey &&
        previousPartitionKey !== nextPartitionKey &&
        previousPartitionKey !== GUEST_PENDING_MUTATION_PARTITION
      ) {
        storage.quarantinePartition({
          partitionKey: previousPartitionKey,
          now: Date.now(),
          reason: 'user-switched',
        })
      }

      reloadPendingMutations()
    },
    { immediate: true },
  )

  return {
    acceptMutation,
    activePartitionKey,
    confirmTxid,
    markMutationRejected,
    markMutationRetryableError,
    markMutationSending,
    pendingMutations: readonly(pendingMutations),
    quarantineActivePartition,
    reconcileWithConfirmedTodos,
    recordPendingMutation,
    reloadPendingMutations,
    transportState,
  }
}
