import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'

import {
  GUEST_PENDING_MUTATION_PARTITION,
  createPendingMutationStorage,
  getPendingMutationPartitionKey,
} from './pending-mutation-storage.ts'

type MemoryStorage = Storage

function createMemoryStorage(): MemoryStorage {
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

const optimisticTodo: Todo = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Pending todo',
  weekNumber: 12,
  done: false,
  archived: false,
  createdAt: 10,
  updatedAt: 20,
  deviceId: 'device-1',
  userId: 'user-a',
  deletedAt: null,
}

test('getPendingMutationPartitionKey keeps guest migration separate from user partitions', () => {
  assert.equal(getPendingMutationPartitionKey(null), GUEST_PENDING_MUTATION_PARTITION)
  assert.equal(getPendingMutationPartitionKey('user-a'), 'user:user-a')
})

test('createPendingMutationStorage persists entries inside their user partition only', () => {
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })

  storage.save({
    mutationId: 'mutation-a',
    partitionKey: getPendingMutationPartitionKey('user-a'),
    kind: 'create',
    todoId: optimisticTodo.id,
    status: 'queued',
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo,
    intent: {
      kind: 'create',
      mutationId: 'mutation-a',
      todoId: optimisticTodo.id,
      values: {
        label: optimisticTodo.label,
        weekNumber: optimisticTodo.weekNumber,
        done: optimisticTodo.done,
        archived: optimisticTodo.archived,
        createdAt: optimisticTodo.createdAt,
        updatedAt: optimisticTodo.updatedAt,
        deletedAt: null,
      },
    },
  })
  storage.save({
    mutationId: 'mutation-b',
    partitionKey: getPendingMutationPartitionKey('user-b'),
    kind: 'delete',
    todoId: '22222222-2222-4222-8222-222222222222',
    status: 'queued',
    createdAt: 20,
    updatedAt: 20,
    optimisticTodo: null,
    intent: {
      kind: 'delete',
      mutationId: 'mutation-b',
      todoId: '22222222-2222-4222-8222-222222222222',
      values: { deletedAt: 20, updatedAt: 20 },
    },
  })

  assert.equal(storage.list(getPendingMutationPartitionKey('user-a')).length, 1)
  assert.equal(storage.list(getPendingMutationPartitionKey('user-b')).length, 1)
  assert.equal(storage.list(GUEST_PENDING_MUTATION_PARTITION).length, 0)
})

test('createPendingMutationStorage quarantines a partition without leaking it into active pending work', () => {
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const partitionKey = getPendingMutationPartitionKey('user-a')

  storage.save({
    mutationId: 'mutation-a',
    partitionKey,
    kind: 'create',
    todoId: optimisticTodo.id,
    status: 'accepted-awaiting-sync',
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo,
    accepted: {
      mutationId: 'mutation-a',
      todoId: optimisticTodo.id,
      txid: '44',
    },
    intent: {
      kind: 'create',
      mutationId: 'mutation-a',
      todoId: optimisticTodo.id,
      values: {
        label: optimisticTodo.label,
        weekNumber: optimisticTodo.weekNumber,
        done: optimisticTodo.done,
        archived: optimisticTodo.archived,
        createdAt: optimisticTodo.createdAt,
        updatedAt: optimisticTodo.updatedAt,
        deletedAt: null,
      },
    },
  })

  storage.quarantinePartition({
    partitionKey,
    now: 50,
    reason: 'user-switched',
  })

  const [entry] = storage.list(partitionKey)
  assert.equal(entry?.status, 'quarantined')
  assert.equal(entry?.quarantine?.reason, 'user-switched')
  assert.equal(storage.listActive(partitionKey).length, 0)
})

test('createPendingMutationStorage allows the same mutation id in different partitions', () => {
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const mutationId = 'shared-mutation-id'
  const userAPartition = getPendingMutationPartitionKey('user-a')
  const userBPartition = getPendingMutationPartitionKey('user-b')

  storage.save({
    mutationId,
    partitionKey: userAPartition,
    kind: 'create',
    todoId: optimisticTodo.id,
    status: 'queued',
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo,
    intent: {
      kind: 'create',
      mutationId,
      todoId: optimisticTodo.id,
      values: {
        label: optimisticTodo.label,
        weekNumber: optimisticTodo.weekNumber,
        done: optimisticTodo.done,
        archived: optimisticTodo.archived,
        createdAt: optimisticTodo.createdAt,
        updatedAt: optimisticTodo.updatedAt,
        deletedAt: null,
      },
    },
  })

  storage.save({
    mutationId,
    partitionKey: userBPartition,
    kind: 'delete',
    todoId: '22222222-2222-4222-8222-222222222222',
    status: 'queued',
    createdAt: 20,
    updatedAt: 20,
    optimisticTodo: null,
    intent: {
      kind: 'delete',
      mutationId,
      todoId: '22222222-2222-4222-8222-222222222222',
      values: { deletedAt: 20, updatedAt: 20 },
    },
  })

  assert.equal(storage.list(userAPartition).length, 1)
  assert.equal(storage.list(userBPartition).length, 1)
  assert.equal(storage.list(userAPartition)[0]?.todoId, optimisticTodo.id)
  assert.equal(storage.list(userBPartition)[0]?.todoId, '22222222-2222-4222-8222-222222222222')
})
