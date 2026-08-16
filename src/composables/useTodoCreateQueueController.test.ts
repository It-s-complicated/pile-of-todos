import { nextTick, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import {
  createOfflineTodoMutationQueue,
  type QueuedTodoMutation,
} from '@/lib/offline-todo-mutation-queue'

type MockRpcResponse = {
  data: unknown
  error: {
    code?: string
    details?: string | null
    hint?: string | null
    message: string
  } | null
}

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

function createDeferred<T>() {
  let resolve: ((value: T | PromiseLike<T>) => void) | null = null
  let reject: ((reason?: unknown) => void) | null = null
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })

  return {
    promise,
    reject: reject!,
    resolve: resolve!,
  }
}

async function settleControllerState(cycles = 5) {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

const optimisticTodo: Todo = {
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

const queuedCreateMutation: QueuedTodoMutation = {
  kind: 'create',
  mutationId: 'mutation-a',
  optimisticTodo,
  todoId: optimisticTodo.id,
  values: {
    archived: false,
    createdAt: 10,
    deletedAt: null,
    done: false,
    label: optimisticTodo.label,
    updatedAt: 10,
    weekNumber: 12,
  },
}

beforeEach(() => {
  vi.resetModules()
})

test('queued create stays pending until the confirmed snapshot refresh completes', async () => {
  const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
  const authVersion = ref('token-a')
  const isAuthReady = ref(true)
  const isOnline = ref(false)
  const userId = ref<string | null>('user-a')
  const storage = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })
  const confirmation = createDeferred<void>()
  const refreshConfirmedTodos = vi.fn<() => Promise<void>>(() => confirmation.promise)
  const rpc = vi.fn<
    (functionName: 'apply_todo_mutation', params: { intent: unknown }) => Promise<MockRpcResponse>
  >(async () => ({
    data: {
      mutationId: 'mutation-a',
      todoId: optimisticTodo.id,
      txid: '41',
    },
    error: null,
  }))
  const writeClient = {
    rpc,
  }
  const { useTodoMutationQueueController } = await import('./useTodoCreateQueueController')
  const controller = useTodoMutationQueueController({
    auth: {
      accessState,
      authVersion,
      isAuthReady,
      userId,
    },
    network: {
      isOnline,
    },
    refreshConfirmedTodos,
    storage,
    writeClient: writeClient as never,
  })

  controller.queueMutation(queuedCreateMutation)

  isOnline.value = true
  await settleControllerState()

  assert.equal(rpc.mock.calls.length, 1)
  assert.equal(controller.acceptedMutationCount.value, 1)
  assert.equal(controller.pendingMutationCount.value, 1)

  confirmation.resolve()
  await settleControllerState()

  assert.equal(refreshConfirmedTodos.mock.calls.length, 1)
  assert.equal(controller.pendingMutationCount.value, 0)
})

test('failed snapshot refresh preserves an accepted entry without repeating its RPC', async () => {
  const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
  const authVersion = ref('token-a')
  const isAuthReady = ref(true)
  const isOnline = ref(false)
  const userId = ref<string | null>('user-a')
  const storage = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })
  const refreshConfirmedTodos = vi.fn<() => Promise<void>>()
  refreshConfirmedTodos.mockRejectedValueOnce(new Error('Snapshot request failed'))
  refreshConfirmedTodos.mockResolvedValueOnce()
  const rpc = vi.fn<
    (functionName: 'apply_todo_mutation', params: { intent: unknown }) => Promise<MockRpcResponse>
  >(async () => ({
    data: {
      mutationId: 'mutation-a',
      todoId: optimisticTodo.id,
    },
    error: null,
  }))
  const { useTodoMutationQueueController } = await import('./useTodoCreateQueueController')
  const controller = useTodoMutationQueueController({
    auth: { accessState, authVersion, isAuthReady, userId },
    network: { isOnline },
    refreshConfirmedTodos,
    storage,
    writeClient: { rpc } as never,
  })

  controller.queueMutation(queuedCreateMutation)

  isOnline.value = true
  await settleControllerState()

  assert.equal(controller.lastErrorKind.value, 'retryable')
  assert.equal(controller.acceptedMutationCount.value, 1)
  assert.equal(rpc.mock.calls.length, 1)

  await controller.flushPendingMutations()

  assert.equal(refreshConfirmedTodos.mock.calls.length, 2)
  assert.equal(rpc.mock.calls.length, 1)
  assert.equal(controller.pendingMutationCount.value, 0)
})

test('same-user reauth preserves pending work and resumes it after session refresh', async () => {
  const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
  const authVersion = ref('token-a')
  const isAuthReady = ref(true)
  const isOnline = ref(false)
  const userId = ref<string | null>('user-a')
  const storage = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })
  const refreshConfirmedTodos = vi.fn<() => Promise<void>>(async () => undefined)
  const rpc = vi.fn<
    (functionName: 'apply_todo_mutation', params: { intent: unknown }) => Promise<MockRpcResponse>
  >(async () => ({
    data: null,
    error: null,
  }))
  rpc.mockResolvedValueOnce({
    data: null,
    error: {
      code: '401',
      message: 'JWT expired',
    },
  })
  rpc.mockResolvedValueOnce({
    data: {
      mutationId: 'mutation-a',
      todoId: optimisticTodo.id,
      txid: '42',
    },
    error: null,
  })
  const writeClient = {
    rpc,
  }
  const { useTodoMutationQueueController } = await import('./useTodoCreateQueueController')
  const controller = useTodoMutationQueueController({
    auth: {
      accessState,
      authVersion,
      isAuthReady,
      userId,
    },
    network: {
      isOnline,
    },
    refreshConfirmedTodos,
    storage,
    writeClient: writeClient as never,
  })

  controller.queueMutation(queuedCreateMutation)

  isOnline.value = true
  await settleControllerState()

  assert.equal(controller.lastErrorKind.value, 'requires-reauth')
  assert.equal(controller.pendingMutationCount.value, 1)

  authVersion.value = 'token-b'
  await settleControllerState()

  assert.equal(controller.lastErrorKind.value, 'none')

  await controller.flushPendingMutations()

  assert.equal(rpc.mock.calls.length, 2)
  assert.equal(controller.pendingMutationCount.value, 0)
})

test('retryable failures automatically retry with backoff', async () => {
  vi.useFakeTimers()

  try {
    const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
    const authVersion = ref('token-a')
    const isAuthReady = ref(true)
    const isOnline = ref(false)
    const userId = ref<string | null>('user-a')
    const storage = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })
    const rpc =
      vi.fn<
        (
          functionName: 'apply_todo_mutation',
          params: { intent: unknown },
        ) => Promise<MockRpcResponse>
      >()
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Temporary network failure' },
    })
    rpc.mockResolvedValueOnce({
      data: { mutationId: 'mutation-a', todoId: optimisticTodo.id },
      error: null,
    })
    const { useTodoMutationQueueController } = await import('./useTodoCreateQueueController')
    const controller = useTodoMutationQueueController({
      auth: { accessState, authVersion, isAuthReady, userId },
      network: { isOnline },
      refreshConfirmedTodos: vi.fn<() => Promise<void>>(async () => undefined),
      storage,
      writeClient: { rpc } as never,
    })

    controller.queueMutation(queuedCreateMutation)

    isOnline.value = true
    await settleControllerState()

    assert.equal(rpc.mock.calls.length, 1)
    assert.equal(controller.lastErrorKind.value, 'retryable')

    await vi.advanceTimersByTimeAsync(1_000)
    await settleControllerState()

    assert.equal(rpc.mock.calls.length, 2)
    assert.equal(controller.lastErrorKind.value, 'none')
    assert.equal(controller.pendingMutationCount.value, 0)
  } finally {
    vi.useRealTimers()
  }
})

test('coming back online immediately resumes a parked retryable queue', async () => {
  vi.useFakeTimers()

  try {
    const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
    const authVersion = ref('token-a')
    const isAuthReady = ref(true)
    const isOnline = ref(false)
    const userId = ref<string | null>('user-a')
    const storage = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })
    const rpc =
      vi.fn<
        (
          functionName: 'apply_todo_mutation',
          params: { intent: unknown },
        ) => Promise<MockRpcResponse>
      >()
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Temporary network failure' },
    })
    rpc.mockResolvedValueOnce({
      data: { mutationId: 'mutation-a', todoId: optimisticTodo.id },
      error: null,
    })
    const { useTodoMutationQueueController } = await import('./useTodoCreateQueueController')
    const controller = useTodoMutationQueueController({
      auth: { accessState, authVersion, isAuthReady, userId },
      network: { isOnline },
      refreshConfirmedTodos: vi.fn<() => Promise<void>>(async () => undefined),
      storage,
      writeClient: { rpc } as never,
    })

    controller.queueMutation(queuedCreateMutation)

    isOnline.value = true
    await settleControllerState()
    assert.equal(controller.lastErrorKind.value, 'retryable')

    isOnline.value = false
    await settleControllerState()
    isOnline.value = true
    await settleControllerState()

    assert.equal(rpc.mock.calls.length, 2)
    assert.equal(controller.pendingMutationCount.value, 0)
  } finally {
    vi.useRealTimers()
  }
})

test('user switches isolate the old user queue instead of replaying it under the new user', async () => {
  const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
  const authVersion = ref('token-a')
  const isAuthReady = ref(true)
  const isOnline = ref(false)
  const userId = ref<string | null>('user-a')
  const storage = createOfflineTodoMutationQueue({ storage: createMemoryStorage() })
  const rpc = vi.fn<
    (functionName: 'apply_todo_mutation', params: { intent: unknown }) => Promise<MockRpcResponse>
  >(async () => ({
    data: null,
    error: null,
  }))
  const writeClient = {
    rpc,
  }
  const { useTodoMutationQueueController } = await import('./useTodoCreateQueueController')
  const controller = useTodoMutationQueueController({
    auth: {
      accessState,
      authVersion,
      isAuthReady,
      userId,
    },
    network: {
      isOnline,
    },
    refreshConfirmedTodos: vi.fn<() => Promise<void>>(async () => undefined),
    storage,
    writeClient: writeClient as never,
  })

  controller.queueMutation(queuedCreateMutation)

  assert.equal(controller.pendingMutationCount.value, 1)

  userId.value = 'user-b'
  authVersion.value = 'token-b'
  await settleControllerState()

  assert.equal(controller.pendingMutationCount.value, 0)
  assert.equal(rpc.mock.calls.length, 0)
  assert.equal(storage.list('user:user-a').length, 1)
})
