import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import type { QueuedTodoMutationEntry } from '@/lib/offline-todo-mutation-queue'

import { mergeTodoReadModel } from './todo-read-model-overlay.ts'

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

test('mergeTodoReadModel overlays pending updates on top of confirmed Electric rows', () => {
  const merged = mergeTodoReadModel([confirmedTodo], [
    {
      acceptedAt: null,
      partitionKey: 'user:user-a',
      mutation: {
        kind: 'update',
        mutationId: 'mutation-update',
        optimisticTodo: {
          ...confirmedTodo,
          done: true,
          updatedAt: 30,
        },
        todoId: confirmedTodo.id,
        updates: {
          done: true,
          updatedAt: 30,
        },
      },
      queuedAt: 30,
      state: 'queued',
      txid: null,
      updatedAt: 30,
    },
  ] satisfies QueuedTodoMutationEntry[])

  assert.equal(merged[0]?.done, true)
  assert.equal(merged[0]?.updatedAt, 30)
})

test('mergeTodoReadModel keeps optimistic creates visible until Electric confirms them', () => {
  const createdTodo: Todo = {
    ...confirmedTodo,
    id: '22222222-2222-4222-8222-222222222222',
    label: 'Created offline',
  }

  const merged = mergeTodoReadModel([], [
    {
      acceptedAt: null,
      partitionKey: 'user:user-a',
      mutation: {
        kind: 'create',
        mutationId: 'mutation-create',
        optimisticTodo: createdTodo,
        todoId: createdTodo.id,
        values: {
          archived: false,
          createdAt: createdTodo.createdAt,
          deletedAt: null,
          done: false,
          label: createdTodo.label,
          updatedAt: createdTodo.updatedAt,
          weekNumber: createdTodo.weekNumber,
        },
      },
      queuedAt: 10,
      state: 'accepted',
      txid: 41,
      updatedAt: 10,
    },
  ] satisfies QueuedTodoMutationEntry[])

  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.id, createdTodo.id)
})

test('mergeTodoReadModel lets pending deletes win locally until confirmation', () => {
  const deletedAt = 55
  const merged = mergeTodoReadModel([confirmedTodo], [
    {
      acceptedAt: null,
      partitionKey: 'user:user-a',
      mutation: {
        kind: 'delete',
        mutationId: 'mutation-delete',
        optimisticTodo: {
          ...confirmedTodo,
          deletedAt,
          updatedAt: deletedAt,
        },
        todoId: confirmedTodo.id,
        updates: {
          deletedAt,
          updatedAt: deletedAt,
        },
      },
      queuedAt: deletedAt,
      state: 'queued',
      txid: null,
      updatedAt: deletedAt,
    },
  ] satisfies QueuedTodoMutationEntry[])

  assert.equal(merged[0]?.deletedAt, deletedAt)
})
