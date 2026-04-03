import { nextTick, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

import {
  createPendingMutationStorage,
  getPendingMutationPartitionKey,
} from '@/lib/pending-mutation-storage'
import type { AuthAccessState } from '@/lib/auth-allowlist'
import type { PendingMutationEntry } from '@/lib/pending-mutation-storage'

const removeConfirmedPromotedStagedTodos = vi.fn()

vi.mock('@/lib/todo-storage', () => ({
  removeConfirmedPromotedStagedTodos,
}))

beforeEach(() => {
  removeConfirmedPromotedStagedTodos.mockReset()
})

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

test('useTodoSyncController raises requires-reauth from an auth failure signal until auth state changes', async () => {
  const { useTodoSyncController } = await import('./useTodoSyncController')
  const accessState = ref<AuthAccessState>('approved')
  const userId = ref<string | null>('user-a')
  const sessionVersion = ref('token-a')
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const controller = useTodoSyncController({
    storage,
    auth: {
      accessState,
      authVersion: sessionVersion,
      isAuthReady: ref(true),
      userId,
    },
    network: {
      isOnline: ref(true),
    },
  })

  const locator = controller.recordPendingMutation(
    createPendingEntry(getPendingMutationPartitionKey('user-a')),
  )

  controller.markMutationRequiresReauth(locator, 'JWT expired', 50)

  assert.equal(controller.transportState.value.requiresReauth, true)
  assert.equal(controller.transportState.value.canSend, false)
  assert.equal(controller.pendingMutations.value[0]?.status, 'retryable-error')
  assert.equal(controller.pendingMutations.value[0]?.errorMessage, 'JWT expired')

  accessState.value = 'signed-out'
  await nextTick()
  assert.equal(controller.transportState.value.requiresReauth, true)

  accessState.value = 'approved'
  userId.value = 'user-a'
  await nextTick()
  assert.equal(controller.transportState.value.requiresReauth, false)
})

test('useTodoSyncController clears requires-reauth when the same approved user refreshes session credentials', async () => {
  const { useTodoSyncController } = await import('./useTodoSyncController')
  const accessState = ref<AuthAccessState>('approved')
  const userId = ref<string | null>('user-a')
  const sessionVersion = ref('token-a')
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const controller = useTodoSyncController({
    storage,
    auth: {
      accessState,
      authVersion: sessionVersion,
      isAuthReady: ref(true),
      userId,
    },
    network: {
      isOnline: ref(true),
    },
  })

  const locator = controller.recordPendingMutation(
    createPendingEntry(getPendingMutationPartitionKey('user-a')),
  )

  controller.markMutationRequiresReauth(locator, 'JWT expired', 50)

  assert.equal(controller.transportState.value.requiresReauth, true)
  assert.equal(controller.transportState.value.canSend, false)

  sessionVersion.value = 'token-b'
  await nextTick()

  assert.equal(controller.transportState.value.requiresReauth, false)
  assert.equal(controller.transportState.value.canSend, true)
})

test('useTodoSyncController removes staged migration rows only after reconciliation confirms promoted creates', async () => {
  const { useTodoSyncController } = await import('./useTodoSyncController')
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const controller = useTodoSyncController({
    storage,
    auth: {
      accessState: ref('approved'),
      isAuthReady: ref(true),
      userId: ref<string | null>('user-a'),
    },
    network: {
      isOnline: ref(true),
    },
  })

  controller.recordPendingMutation({
    ...createPendingEntry(getPendingMutationPartitionKey('user-a')),
    accepted: {
      mutationId: 'mutation-a',
      todoId: '11111111-1111-4111-8111-111111111111',
      txid: '42',
    },
    optimisticTodo: {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Pending todo',
      weekNumber: 12,
      done: false,
      archived: false,
      createdAt: 10,
      updatedAt: 10,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
    status: 'accepted-awaiting-sync',
  })

  controller.confirmTxid('42')
  controller.reconcileWithConfirmedTodos([
    {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Pending todo',
      weekNumber: 12,
      done: false,
      archived: false,
      createdAt: 10,
      updatedAt: 10,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
  ])

  assert.deepEqual(removeConfirmedPromotedStagedTodos.mock.calls[0], [
    { confirmedTodoIds: ['11111111-1111-4111-8111-111111111111'] },
  ])
})

test('useTodoSyncController does not clean staged migration rows for accepted work that is still awaiting sync', async () => {
  const { useTodoSyncController } = await import('./useTodoSyncController')
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const controller = useTodoSyncController({
    storage,
    auth: {
      accessState: ref('approved'),
      isAuthReady: ref(true),
      userId: ref<string | null>('user-a'),
    },
    network: {
      isOnline: ref(true),
    },
  })

  controller.recordPendingMutation({
    ...createPendingEntry(getPendingMutationPartitionKey('user-a')),
    accepted: {
      mutationId: 'mutation-a',
      todoId: '11111111-1111-4111-8111-111111111111',
      txid: '42',
    },
    status: 'accepted-awaiting-sync',
  })

  controller.reconcileWithConfirmedTodos([])

  assert.equal(removeConfirmedPromotedStagedTodos.mock.calls.length, 0)
})

test('useTodoSyncController still cleans staged migration rows after reload once later confirmation arrives', async () => {
  const { useTodoSyncController } = await import('./useTodoSyncController')
  const storage = createPendingMutationStorage({ storage: createMemoryStorage() })
  const partitionKey = getPendingMutationPartitionKey('user-a')

  storage.save({
    ...createPendingEntry(partitionKey),
    accepted: {
      mutationId: 'mutation-a',
      todoId: '11111111-1111-4111-8111-111111111111',
      txid: '42',
    },
    optimisticTodo: {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Pending todo',
      weekNumber: 12,
      done: false,
      archived: false,
      createdAt: 10,
      updatedAt: 10,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
    status: 'accepted-awaiting-sync',
  })

  const controller = useTodoSyncController({
    storage,
    auth: {
      accessState: ref('approved'),
      isAuthReady: ref(true),
      userId: ref<string | null>('user-a'),
    },
    network: {
      isOnline: ref(true),
    },
  })

  controller.reconcileWithConfirmedTodos([])
  assert.equal(removeConfirmedPromotedStagedTodos.mock.calls.length, 0)

  controller.confirmTxid('42')
  controller.reconcileWithConfirmedTodos([
    {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Pending todo',
      weekNumber: 12,
      done: false,
      archived: false,
      createdAt: 10,
      updatedAt: 10,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
  ])

  assert.deepEqual(removeConfirmedPromotedStagedTodos.mock.calls[0], [
    { confirmedTodoIds: ['11111111-1111-4111-8111-111111111111'] },
  ])
})
