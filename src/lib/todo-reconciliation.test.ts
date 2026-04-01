import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import type { PendingMutationEntry } from './pending-mutation-storage.ts'

import { reconcilePendingMutations } from './todo-reconciliation.ts'

const confirmedTodo: Todo = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Confirmed todo',
  weekNumber: 12,
  done: false,
  archived: false,
  createdAt: 10,
  updatedAt: 20,
  deviceId: 'device-1',
  userId: 'user-a',
  deletedAt: null,
}

test('reconcilePendingMutations confirms an accepted mutation only after txid proof and baseline proof succeed', () => {
  const [entry] = reconcilePendingMutations({
    confirmedTodos: [{ ...confirmedTodo, label: 'Confirmed after sync', updatedAt: 30 }],
    pendingMutations: [
      {
        mutationId: 'mutation-update',
        partitionKey: 'user:user-a',
        kind: 'update',
        todoId: confirmedTodo.id,
        status: 'accepted-awaiting-sync',
        createdAt: 10,
        updatedAt: 10,
        optimisticTodo: { ...confirmedTodo, label: 'Confirmed after sync', updatedAt: 30 },
        accepted: {
          mutationId: 'mutation-update',
          todoId: confirmedTodo.id,
          txid: '44',
        },
        intent: {
          kind: 'update',
          mutationId: 'mutation-update',
          todoId: confirmedTodo.id,
          values: {
            label: 'Confirmed after sync',
            updatedAt: 30,
          },
        },
      } satisfies PendingMutationEntry,
    ],
    confirmedTxids: new Set(['44']),
  })

  assert.equal(entry?.status, 'confirmed')
})

test('reconcilePendingMutations quarantines accepted work when txid proof resolves but the baseline proof fails', () => {
  const [entry] = reconcilePendingMutations({
    confirmedTodos: [confirmedTodo],
    pendingMutations: [
      {
        mutationId: 'mutation-update',
        partitionKey: 'user:user-a',
        kind: 'update',
        todoId: confirmedTodo.id,
        status: 'accepted-awaiting-sync',
        createdAt: 10,
        updatedAt: 10,
        optimisticTodo: { ...confirmedTodo, label: 'Optimistic label', updatedAt: 30 },
        accepted: {
          mutationId: 'mutation-update',
          todoId: confirmedTodo.id,
          txid: '44',
        },
        intent: {
          kind: 'update',
          mutationId: 'mutation-update',
          todoId: confirmedTodo.id,
          values: {
            label: 'Optimistic label',
            updatedAt: 30,
          },
        },
      } satisfies PendingMutationEntry,
    ],
    confirmedTxids: new Set(['44']),
  })

  assert.equal(entry?.status, 'invariant-violation')
  assert.equal(entry?.quarantine?.reason, 'confirmation-proof-failed')
})

test('reconcilePendingMutations keeps unsent work queued after a reset refetch when Postgres never accepted it', () => {
  const [entry] = reconcilePendingMutations({
    confirmedTodos: [],
    pendingMutations: [
      {
        mutationId: 'mutation-create',
        partitionKey: 'user:user-a',
        kind: 'create',
        todoId: confirmedTodo.id,
        status: 'queued',
        createdAt: 10,
        updatedAt: 10,
        optimisticTodo: confirmedTodo,
        intent: {
          kind: 'create',
          mutationId: 'mutation-create',
          todoId: confirmedTodo.id,
          values: {
            label: confirmedTodo.label,
            weekNumber: confirmedTodo.weekNumber,
            done: confirmedTodo.done,
            archived: confirmedTodo.archived,
            createdAt: confirmedTodo.createdAt,
            updatedAt: confirmedTodo.updatedAt,
            deletedAt: null,
          },
        },
      } satisfies PendingMutationEntry,
    ],
    afterResetRefetch: true,
    confirmedTxids: new Set(),
  })

  assert.equal(entry?.status, 'queued')
})

test('reconcilePendingMutations quarantines accepted work after reset refetch when txid confirmation cannot be re-established', () => {
  const [entry] = reconcilePendingMutations({
    confirmedTodos: [],
    pendingMutations: [
      {
        mutationId: 'mutation-create',
        partitionKey: 'user:user-a',
        kind: 'create',
        todoId: confirmedTodo.id,
        status: 'accepted-awaiting-sync',
        createdAt: 10,
        updatedAt: 10,
        optimisticTodo: confirmedTodo,
        accepted: {
          mutationId: 'mutation-create',
          todoId: confirmedTodo.id,
          txid: '44',
        },
        intent: {
          kind: 'create',
          mutationId: 'mutation-create',
          todoId: confirmedTodo.id,
          values: {
            label: confirmedTodo.label,
            weekNumber: confirmedTodo.weekNumber,
            done: confirmedTodo.done,
            archived: confirmedTodo.archived,
            createdAt: confirmedTodo.createdAt,
            updatedAt: confirmedTodo.updatedAt,
            deletedAt: null,
          },
        },
      } satisfies PendingMutationEntry,
    ],
    afterResetRefetch: true,
    confirmedTxids: new Set(),
  })

  assert.equal(entry?.status, 'invariant-violation')
  assert.equal(entry?.quarantine?.reason, 'txid-confirmation-lost-after-reset')
})
