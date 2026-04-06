import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'

import {
  createOfflineTodoCreateQueue,
  getOfflineTodoCreatePartitionKey,
} from './offline-todo-create-queue.ts'

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

test('getOfflineTodoCreatePartitionKey scopes queued creates by user id', () => {
  assert.equal(getOfflineTodoCreatePartitionKey('user-a'), 'user:user-a')
  assert.equal(getOfflineTodoCreatePartitionKey(null), 'signed-out')
})

test('createOfflineTodoCreateQueue persists queued creates per partition', () => {
  const queue = createOfflineTodoCreateQueue({ storage: createMemoryStorage() })

  queue.save({
    partitionKey: getOfflineTodoCreatePartitionKey('user-a'),
    queuedAt: 10,
    todo: queuedTodo,
    updatedAt: 10,
  })
  queue.save({
    partitionKey: getOfflineTodoCreatePartitionKey('user-b'),
    queuedAt: 20,
    todo: {
      ...queuedTodo,
      id: '22222222-2222-4222-8222-222222222222',
      userId: 'user-b',
    },
    updatedAt: 20,
  })

  assert.equal(queue.list(getOfflineTodoCreatePartitionKey('user-a')).length, 1)
  assert.equal(queue.list(getOfflineTodoCreatePartitionKey('user-b')).length, 1)
  assert.equal(queue.list(getOfflineTodoCreatePartitionKey(null)).length, 0)
})

test('createOfflineTodoCreateQueue replaces an existing queued create for the same todo id', () => {
  const queue = createOfflineTodoCreateQueue({ storage: createMemoryStorage() })
  const partitionKey = getOfflineTodoCreatePartitionKey('user-a')

  queue.save({
    partitionKey,
    queuedAt: 10,
    todo: queuedTodo,
    updatedAt: 10,
  })
  queue.save({
    partitionKey,
    queuedAt: 20,
    todo: {
      ...queuedTodo,
      label: 'Updated queued todo',
      updatedAt: 20,
    },
    updatedAt: 20,
  })

  const [entry] = queue.list(partitionKey)

  assert.equal(entry?.todo.label, 'Updated queued todo')
  assert.equal(queue.list(partitionKey).length, 1)
})
