import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'

import {
  createOfflineTodoMutationQueue,
  getOfflineTodoMutationPartitionKey,
} from './offline-todo-mutation-queue.ts'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

const queuedTodo: Todo = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Queued todo',
  weekNumber: 12,
  done: false,
  archived: false,
  createdAt: 10,
  updatedAt: 10,
  deviceId: 'device-1',
  userId: 'user-a',
  deletedAt: null,
}

test('getOfflineTodoMutationPartitionKey scopes queued mutations by user id', () => {
  assert.equal(getOfflineTodoMutationPartitionKey('user-a'), 'user:user-a')
  assert.equal(getOfflineTodoMutationPartitionKey(null), 'signed-out')
})

test('createOfflineTodoMutationQueue persists queued mutations per partition', () => {
  const queue = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })

  queue.save({
    acceptedAt: null,
    partitionKey: getOfflineTodoMutationPartitionKey('user-a'),
    mutation: {
      kind: 'create',
      mutationId: 'mutation-a',
      optimisticTodo: queuedTodo,
      todoId: queuedTodo.id,
      values: {
        archived: false,
        createdAt: 10,
        deletedAt: null,
        done: false,
        label: queuedTodo.label,
        updatedAt: 10,
        weekNumber: 12,
      },
    },
    queuedAt: 10,
    state: 'queued',
    txid: null,
    updatedAt: 10,
  })
  queue.save({
    acceptedAt: 25,
    partitionKey: getOfflineTodoMutationPartitionKey('user-b'),
    mutation: {
      kind: 'update',
      mutationId: 'mutation-b',
      optimisticTodo: {
        ...queuedTodo,
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'user-b',
      },
      todoId: '22222222-2222-4222-8222-222222222222',
      updates: {
        done: true,
        updatedAt: 25,
      },
    },
    queuedAt: 20,
    state: 'accepted',
    txid: 42,
    updatedAt: 25,
  })

  assert.equal(queue.list(getOfflineTodoMutationPartitionKey('user-a')).length, 1)
  assert.equal(queue.list(getOfflineTodoMutationPartitionKey('user-b')).length, 1)
  assert.equal(queue.list(getOfflineTodoMutationPartitionKey(null)).length, 0)
})

test('createOfflineTodoMutationQueue replaces an existing queued mutation with the same mutation id', () => {
  const queue = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })
  const partitionKey = getOfflineTodoMutationPartitionKey('user-a')

  queue.save({
    acceptedAt: null,
    partitionKey,
    mutation: {
      kind: 'update',
      mutationId: 'mutation-a',
      optimisticTodo: queuedTodo,
      todoId: queuedTodo.id,
      updates: {
        label: queuedTodo.label,
        updatedAt: 10,
      },
    },
    queuedAt: 10,
    state: 'queued',
    txid: null,
    updatedAt: 10,
  })
  queue.save({
    acceptedAt: 20,
    partitionKey,
    mutation: {
      kind: 'update',
      mutationId: 'mutation-a',
      optimisticTodo: {
        ...queuedTodo,
        label: 'Updated queued todo',
        updatedAt: 20,
      },
      todoId: queuedTodo.id,
      updates: {
        label: 'Updated queued todo',
        updatedAt: 20,
      },
    },
    queuedAt: 10,
    state: 'accepted',
    txid: 99,
    updatedAt: 20,
  })

  const [entry] = queue.list(partitionKey)

  assert.equal(entry?.mutation.optimisticTodo.label, 'Updated queued todo')
  assert.equal(entry?.state, 'accepted')
  assert.equal(queue.list(partitionKey).length, 1)
})

test('createOfflineTodoMutationQueue migrates legacy queued creates into pending mutations', () => {
  const storage = createMemoryStorage()
  storage.setItem(
    'ai-todo-app-offline-created-todos',
    JSON.stringify([
      {
        partitionKey: getOfflineTodoMutationPartitionKey('user-a'),
        queuedAt: 10,
        todo: queuedTodo,
        updatedAt: 10,
      },
    ]),
  )

  const queue = createOfflineTodoMutationQueue({ storage })
  const [entry] = queue.list(getOfflineTodoMutationPartitionKey('user-a'))

  assert.equal(entry?.mutation.kind, 'create')
  assert.equal(entry?.mutation.todoId, queuedTodo.id)
  assert.equal(entry?.state, 'queued')
  assert.equal(storage.getItem('ai-todo-app-offline-created-todos'), null)
})
