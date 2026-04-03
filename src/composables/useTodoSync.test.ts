import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import type { PendingMutationEntry } from '@/lib/pending-mutation-storage'

const confirmedTodos = ref<Todo[]>([])
const pendingMutations = ref<PendingMutationEntry[]>([])
const isReady = ref(true)
const isOnline = ref(true)
const transportState = ref({
  canSend: true,
  hasInvariantViolations: false,
  isAuthReady: true,
  isOnline: true,
  requiresReauth: false,
})

const reconcileWithConfirmedTodos = vi.fn()
const flushPendingMutations = vi.fn(async () => true)
const confirmedTodosCollectionMetadata = new Map<string, unknown>()
const confirmedTodosCollectionListeners = new Map<string, Set<() => void>>()

function emitConfirmedTodosCollectionEvent(event: string) {
  confirmedTodosCollectionListeners.get(event)?.forEach((listener) => listener())
}

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    connectivity: {
      isOnline,
      isReady,
    },
    readModel: {
      confirmedTodos,
      isReady,
      pendingMutations,
    },
    sync: {
      controller: {
        pendingMutations: computed(() => pendingMutations.value),
        reconcileWithConfirmedTodos,
        transportState,
      },
    },
  }),
}))

vi.mock('./useTodoMutations', () => ({
  useTodoMutations: () => ({
    flushPendingMutations,
  }),
}))

vi.mock('@/db/confirmed-todos', () => ({
  readConfirmedTodosResumeState: () =>
    confirmedTodosCollectionMetadata.get('electric:resume') ?? null,
  subscribeToConfirmedTodosTruncate: (callback: () => void) => {
    const listeners = confirmedTodosCollectionListeners.get('truncate') ?? new Set<() => void>()
    listeners.add(callback)
    confirmedTodosCollectionListeners.set('truncate', listeners)
    return () => listeners.delete(callback)
  },
}))

function createPendingMutation(status: PendingMutationEntry['status']): PendingMutationEntry {
  return {
    mutationId: `mutation-${status}`,
    partitionKey: 'user:user-a',
    kind: 'update',
    todoId: '11111111-1111-4111-8111-111111111111',
    status,
    createdAt: 10,
    updatedAt: 10,
    optimisticTodo: null,
    intent: {
      kind: 'update',
      mutationId: `mutation-${status}`,
      todoId: '11111111-1111-4111-8111-111111111111',
      values: {
        label: 'Updated',
        updatedAt: 10,
        deletedAt: null,
      },
    },
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  confirmedTodos.value = []
  pendingMutations.value = []
  isReady.value = true
  isOnline.value = true
  transportState.value = {
    canSend: true,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: true,
    requiresReauth: false,
  }
  confirmedTodosCollectionMetadata.clear()
  confirmedTodosCollectionMetadata.set('electric:resume', {
    kind: 'resume',
    offset: '1',
    handle: 'handle-a',
    shapeId: 'shape-a',
    updatedAt: 1,
  })
  confirmedTodosCollectionListeners.clear()
})

test('useTodoSync surfaces retryable degraded state for pending delivery failures', async () => {
  pendingMutations.value = [createPendingMutation('retryable-error')]
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'paused')
  assert.equal(sync.degradedStatus.value, 'retryable-error')
  assert.equal(sync.canRetrySync.value, true)
})

test('useTodoSync surfaces reauth pauses ahead of ordinary retry work', async () => {
  pendingMutations.value = [createPendingMutation('retryable-error')]
  transportState.value = {
    canSend: false,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: true,
    requiresReauth: true,
  }
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'paused')
  assert.equal(sync.degradedStatus.value, 'requires-reauth')
  assert.equal(sync.canRetrySync.value, false)
})

test('useTodoSync retries queued work through the shared mutation dispatcher', async () => {
  pendingMutations.value = [createPendingMutation('queued')]
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()
  flushPendingMutations.mockClear()
  await sync.syncTodos()

  assert.equal(flushPendingMutations.mock.calls.length, 1)
})

test('useTodoSync keeps ordinary sending writes out of the syncing state', async () => {
  pendingMutations.value = [createPendingMutation('sending')]
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'synced')
})

test('useTodoSync does not keep accepted work in the syncing state while it only awaits confirmation', async () => {
  pendingMutations.value = [createPendingMutation('accepted-awaiting-sync')]
  flushPendingMutations.mockImplementation(() => new Promise<boolean>(() => {}))
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()
  await Promise.resolve()

  assert.ok(flushPendingMutations.mock.calls.length > 0)
  assert.equal(sync.syncStatus.value, 'synced')
})

test('useTodoSync starts recovering accepted work that was already loaded from storage', async () => {
  pendingMutations.value = [createPendingMutation('accepted-awaiting-sync')]
  const { useTodoSync } = await import('./useTodoSync')

  useTodoSync()
  await Promise.resolve()

  assert.ok(flushPendingMutations.mock.calls.length > 0)
})

test('useTodoSync reconciles accepted work with afterResetRefetch after Electric truncates and reloads the baseline', async () => {
  pendingMutations.value = [createPendingMutation('accepted-awaiting-sync')]
  const { useTodoSync } = await import('./useTodoSync')

  useTodoSync()
  reconcileWithConfirmedTodos.mockClear()

  confirmedTodosCollectionMetadata.set('electric:resume', {
    kind: 'reset',
    updatedAt: 2,
  })
  emitConfirmedTodosCollectionEvent('truncate')

  confirmedTodos.value = []

  confirmedTodosCollectionMetadata.set('electric:resume', {
    kind: 'resume',
    offset: '2',
    handle: 'handle-b',
    shapeId: 'shape-a',
    updatedAt: 3,
  })
  confirmedTodos.value = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Reloaded baseline',
      weekNumber: null,
      done: false,
      archived: false,
      createdAt: 10,
      updatedAt: 10,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
  ]

  await new Promise((resolve) => setTimeout(resolve, 30))

  const finalCall = reconcileWithConfirmedTodos.mock.calls.at(-1)

  assert.deepEqual(finalCall, [confirmedTodos.value, { afterResetRefetch: true }])
})
