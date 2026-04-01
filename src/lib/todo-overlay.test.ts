import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import type { PendingMutationEntry } from './pending-mutation-storage.ts'

import { buildTodoOverlay } from './todo-overlay.ts'

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

test('buildTodoOverlay keeps an optimistic create visible until Electric confirms the row', () => {
  const pendingCreate: PendingMutationEntry = {
    mutationId: 'mutation-create',
    partitionKey: 'user:user-a',
    kind: 'create',
    todoId: confirmedTodo.id,
    status: 'accepted-awaiting-sync',
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo: { ...confirmedTodo, label: 'Optimistic create' },
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
        label: 'Optimistic create',
        weekNumber: 12,
        done: false,
        archived: false,
        createdAt: 10,
        updatedAt: 20,
        deletedAt: null,
      },
    },
  }

  assert.deepEqual(buildTodoOverlay({ confirmedTodos: [], pendingMutations: [pendingCreate] }), [
    { ...confirmedTodo, label: 'Optimistic create' },
  ])
  assert.deepEqual(
    buildTodoOverlay({ confirmedTodos: [confirmedTodo], pendingMutations: [pendingCreate] }),
    [confirmedTodo],
  )
})

test('buildTodoOverlay keeps optimistic update fields while allowing non-overlapping Electric fields through', () => {
  const pendingUpdate: PendingMutationEntry = {
    mutationId: 'mutation-update',
    partitionKey: 'user:user-a',
    kind: 'update',
    todoId: confirmedTodo.id,
    status: 'sending',
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo: {
      ...confirmedTodo,
      label: 'Optimistic label',
      updatedAt: 30,
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
  }

  assert.deepEqual(
    buildTodoOverlay({
      confirmedTodos: [{ ...confirmedTodo, archived: true, updatedAt: 25 }],
      pendingMutations: [pendingUpdate],
    }),
    [{ ...confirmedTodo, label: 'Optimistic label', archived: true, updatedAt: 30 }],
  )
})

test('buildTodoOverlay hides a todo while a delete is pending', () => {
  const pendingDelete: PendingMutationEntry = {
    mutationId: 'mutation-delete',
    partitionKey: 'user:user-a',
    kind: 'delete',
    todoId: confirmedTodo.id,
    status: 'retryable-error',
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo: null,
    intent: {
      kind: 'delete',
      mutationId: 'mutation-delete',
      todoId: confirmedTodo.id,
      values: {
        deletedAt: 30,
        updatedAt: 30,
      },
    },
  }

  assert.deepEqual(
    buildTodoOverlay({ confirmedTodos: [confirmedTodo], pendingMutations: [pendingDelete] }),
    [],
  )
})
