import { nextTick, ref } from 'vue'
import { assert, test, vi } from 'vite-plus/test'

import {
  createPendingMutationStorage,
  getPendingMutationPartitionKey,
} from '@/lib/pending-mutation-storage'
import type { PendingMutationEntry } from '@/lib/pending-mutation-storage'

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    accessState: ref('approved'),
    isAuthReady: ref(true),
    userId: ref<string | null>('user-a'),
  }),
}))

vi.mock('./useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: ref(true),
  }),
}))

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

function createPendingEntry(partitionKey: string): PendingMutationEntry {
  return {
    mutationId: 'mutation-a',
    partitionKey,
    kind: 'create',
    todoId: '11111111-1111-4111-8111-111111111111',
    status: 'queued',
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo: null,
    intent: {
      kind: 'create',
      mutationId: 'mutation-a',
      todoId: '11111111-1111-4111-8111-111111111111',
      values: {
        label: 'Pending todo',
        weekNumber: 12,
        done: false,
        archived: false,
        createdAt: 10,
        updatedAt: 10,
        deletedAt: null,
      },
    },
  }
}

test('useTodoSyncController quarantines the previous authenticated partition on user switch', async () => {
  const { useTodoSyncController } = await import('./useTodoSyncController')
  const userId = ref<string | null>('user-a')
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const controller = useTodoSyncController({
    storage,
    auth: {
      accessState: ref('approved'),
      isAuthReady: ref(true),
      userId,
    },
    network: {
      isOnline: ref(true),
    },
  })
  const userAPartition = getPendingMutationPartitionKey('user-a')
  const userBPartition = getPendingMutationPartitionKey('user-b')

  controller.recordPendingMutation(createPendingEntry(userAPartition))
  userId.value = 'user-b'
  await nextTick()

  const [quarantinedEntry] = storage.list(userAPartition)
  assert.equal(quarantinedEntry?.status, 'quarantined')
  assert.equal(quarantinedEntry?.quarantine?.reason, 'user-switched')
  assert.equal(controller.activePartitionKey.value, userBPartition)
  assert.equal(controller.pendingMutations.value.length, 0)
})

test('useTodoSyncController updates an in-flight mutation by its original partition after a user switch', async () => {
  const { useTodoSyncController } = await import('./useTodoSyncController')
  const userId = ref<string | null>('user-a')
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const controller = useTodoSyncController({
    storage,
    auth: {
      accessState: ref('approved'),
      isAuthReady: ref(true),
      userId,
    },
    network: {
      isOnline: ref(true),
    },
  })
  const userAPartition = getPendingMutationPartitionKey('user-a')

  const locator = controller.recordPendingMutation(createPendingEntry(userAPartition))
  userId.value = 'user-b'
  await nextTick()

  controller.markMutationRetryableError(locator, 'network lost', 50)

  const [updatedEntry] = storage.list(userAPartition)
  assert.equal(updatedEntry?.status, 'quarantined')
  assert.equal(updatedEntry?.errorMessage, 'network lost')
})
