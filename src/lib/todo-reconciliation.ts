import type { Todo } from '@/db/collections'

import type {
  PendingMutationEntry,
  PendingMutationQuarantineReason,
} from './pending-mutation-storage'

type ReconcilePendingMutationsOptions = {
  confirmedTodos: Todo[]
  pendingMutations: PendingMutationEntry[]
  confirmedTxids: ReadonlySet<string>
  afterResetRefetch?: boolean
  now?: number
}

function getConfirmedTodoMap(confirmedTodos: Todo[]) {
  return new Map(confirmedTodos.map((todo) => [todo.id, todo]))
}

export function satisfiesTodoMutationConfirmationProof(
  mutation: PendingMutationEntry,
  confirmedTodo: Todo | undefined,
) {
  if (mutation.intent.kind === 'create') {
    return confirmedTodo !== undefined
  }

  if (mutation.intent.kind === 'delete') {
    return confirmedTodo === undefined
  }

  if (!confirmedTodo) {
    return false
  }

  const expectedValues = mutation.intent.values

  if (expectedValues.label !== undefined && confirmedTodo.label !== expectedValues.label) {
    return false
  }

  if (
    expectedValues.weekNumber !== undefined &&
    confirmedTodo.weekNumber !== expectedValues.weekNumber
  ) {
    return false
  }

  if (expectedValues.done !== undefined && confirmedTodo.done !== expectedValues.done) {
    return false
  }

  if (expectedValues.archived !== undefined && confirmedTodo.archived !== expectedValues.archived) {
    return false
  }

  if (
    expectedValues.deletedAt !== undefined &&
    confirmedTodo.deletedAt !== expectedValues.deletedAt
  ) {
    return false
  }

  return confirmedTodo.updatedAt === expectedValues.updatedAt
}

function quarantineMutation(
  mutation: PendingMutationEntry,
  now: number,
  reason: PendingMutationQuarantineReason,
): PendingMutationEntry {
  return {
    ...mutation,
    status: 'invariant-violation',
    updatedAt: now,
    quarantine: {
      reason,
      at: now,
    },
  }
}

export function reconcilePendingMutations({
  confirmedTodos,
  pendingMutations,
  confirmedTxids,
  afterResetRefetch = false,
  now = Date.now(),
}: ReconcilePendingMutationsOptions): PendingMutationEntry[] {
  const confirmedTodosById = getConfirmedTodoMap(confirmedTodos)

  return pendingMutations.map((mutation) => {
    if (
      mutation.status === 'confirmed' ||
      mutation.status === 'rejected' ||
      mutation.status === 'quarantined' ||
      mutation.status === 'invariant-violation'
    ) {
      return mutation
    }

    const confirmedTodo = confirmedTodosById.get(mutation.todoId)
    const proofSatisfied = satisfiesTodoMutationConfirmationProof(mutation, confirmedTodo)

    if (mutation.status === 'accepted-awaiting-sync') {
      if (!mutation.accepted) {
        return quarantineMutation(mutation, now, 'confirmation-proof-failed')
      }

      if (confirmedTxids.has(mutation.accepted.txid)) {
        if (!proofSatisfied) {
          return quarantineMutation(mutation, now, 'confirmation-proof-failed')
        }

        return {
          ...mutation,
          status: 'confirmed',
          updatedAt: now,
        }
      }

      if (afterResetRefetch) {
        return quarantineMutation(mutation, now, 'txid-confirmation-lost-after-reset')
      }

      return mutation
    }

    if (proofSatisfied) {
      return {
        ...mutation,
        status: 'confirmed',
        updatedAt: now,
      }
    }

    return mutation
  })
}
