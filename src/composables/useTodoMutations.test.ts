import { computed, ref } from 'vue'
import { assert, test, vi, beforeEach } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import type { PendingMutationEntry } from '@/lib/pending-mutation-storage'
import { buildTodoOverlay } from '@/lib/todo-overlay'

const activeUserId = ref<string | null>('user-a')
const confirmedTodos = ref<Todo[]>([])
const pendingMutations = ref<PendingMutationEntry[]>([])
const transportState = ref({
  canSend: true,
  hasInvariantViolations: false,
  isAuthReady: true,
  isOnline: true,
  requiresReauth: false,
})

const recordPendingMutation = vi.fn()
const markMutationSending = vi.fn()
const acceptMutation = vi.fn()
const markMutationRetryableError = vi.fn()
const markMutationRequiresReauth = vi.fn()
const markMutationRejected = vi.fn()
const confirmTxid = vi.fn()
const reconcileWithConfirmedTodos = vi.fn()
const rpc = vi.fn()
const awaitTxId = vi.fn(async () => true)
const getPendingMutation = vi.fn()
const removePendingMutation = vi.fn()
const replacePendingMutation = vi.fn()

function updatePendingMutationState(
  reference: { partitionKey: string; mutationId: string },
  updater: (entry: PendingMutationEntry) => PendingMutationEntry,
) {
  pendingMutations.value = pendingMutations.value.map((entry) => {
    if (
      entry.partitionKey !== reference.partitionKey ||
      entry.mutationId !== reference.mutationId
    ) {
      return entry
    }

    return updater(entry)
  })
}

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    auth: {
      activeUserId,
    },
    readModel: {
      confirmedTodos,
      pendingMutations,
      todos: computed(() =>
        buildTodoOverlay({
          confirmedTodos: confirmedTodos.value,
          pendingMutations: pendingMutations.value,
        }),
      ),
    },
    sync: {
      controller: {
        acceptMutation,
        activePartitionKey: computed(() => 'user:user-a'),
        confirmTxid,
        getPendingMutation,
        markMutationRejected,
        markMutationRequiresReauth,
        markMutationRetryableError,
        markMutationSending,
        pendingMutations: computed(() => pendingMutations.value),
        reconcileWithConfirmedTodos,
        recordPendingMutation,
        removePendingMutation,
        replacePendingMutation,
        transportState,
      },
    },
  }),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc }),
}))

vi.mock('@/db/collections', async () => {
  return {
    getCurrentDeviceId: () => 'device-1',
  }
})

vi.mock('@/db/confirmed-todos', () => ({
  getConfirmedTodosCollection: () => ({
    utils: {
      awaitTxId,
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  recordPendingMutation.mockReset()
  markMutationSending.mockReset()
  acceptMutation.mockReset()
  markMutationRetryableError.mockReset()
  markMutationRequiresReauth.mockReset()
  markMutationRejected.mockReset()
  confirmTxid.mockReset()
  reconcileWithConfirmedTodos.mockReset()
  rpc.mockReset()
  awaitTxId.mockReset()
  getPendingMutation.mockReset()
  removePendingMutation.mockReset()
  replacePendingMutation.mockReset()
  activeUserId.value = 'user-a'
  confirmedTodos.value = []
  pendingMutations.value = []
  transportState.value = {
    canSend: true,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: true,
    requiresReauth: false,
  }
  recordPendingMutation.mockImplementation((entry) => {
    pendingMutations.value = pendingMutations.value.concat(entry)
    return {
      mutationId: entry.mutationId,
      partitionKey: entry.partitionKey,
    }
  })
  getPendingMutation.mockImplementation(
    (reference) =>
      pendingMutations.value.find(
        (entry) =>
          entry.partitionKey === reference.partitionKey &&
          entry.mutationId === reference.mutationId,
      ) ?? null,
  )
  removePendingMutation.mockImplementation((reference) => {
    pendingMutations.value = pendingMutations.value.filter(
      (entry) =>
        !(
          entry.partitionKey === reference.partitionKey && entry.mutationId === reference.mutationId
        ),
    )
  })
  replacePendingMutation.mockImplementation((reference, nextEntry) => {
    pendingMutations.value = pendingMutations.value
      .filter(
        (entry) =>
          !(
            entry.partitionKey === reference.partitionKey &&
            entry.mutationId === reference.mutationId
          ),
      )
      .concat(nextEntry)

    return {
      mutationId: nextEntry.mutationId,
      partitionKey: nextEntry.partitionKey,
    }
  })
  markMutationSending.mockImplementation((reference) => {
    updatePendingMutationState(reference, (entry) => ({ ...entry, status: 'sending' }))
  })
  acceptMutation.mockImplementation((reference, accepted) => {
    updatePendingMutationState(reference, (entry) => ({
      ...entry,
      status: 'accepted-awaiting-sync',
      accepted,
    }))
  })
  markMutationRetryableError.mockImplementation((reference, errorMessage) => {
    updatePendingMutationState(reference, (entry) => ({
      ...entry,
      status: 'retryable-error',
      errorMessage,
    }))
  })
  markMutationRequiresReauth.mockImplementation((reference, errorMessage) => {
    updatePendingMutationState(reference, (entry) => ({
      ...entry,
      status: 'retryable-error',
      errorMessage,
    }))
  })
  rpc.mockImplementation(async (_fn, args) => {
    const intent = args.intent

    return {
      data: {
        mutationId: intent.mutationId,
        todoId: intent.todoId,
        txid: 42,
      },
      error: null,
    }
  })
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
})

test('useTodoMutations creates ledger-backed todos and waits for txid confirmation', async () => {
  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Ship Phase 3', 14)

  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(todoId, '11111111-1111-4111-8111-111111111111')
  assert.equal(recordPendingMutation.mock.calls.length, 1)
  assert.equal(recordPendingMutation.mock.calls[0][0].intent.kind, 'create')
  assert.equal(recordPendingMutation.mock.calls[0][0].optimisticTodo?.label, 'Ship Phase 3')
  assert.equal(markMutationSending.mock.calls.length, 1)
  assert.equal(acceptMutation.mock.calls[0][1].txid, '42')
  assert.deepEqual(awaitTxId.mock.calls[0], ['42'])
  assert.deepEqual(confirmTxid.mock.calls[0], ['42'])
  assert.deepEqual(reconcileWithConfirmedTodos.mock.calls[0], [confirmedTodos.value])
})

test('useTodoMutations forwards xid8 txids as exact strings into confirmation', async () => {
  rpc.mockImplementationOnce(async (_fn, args) => ({
    data: {
      mutationId: args.intent.mutationId,
      todoId: args.intent.todoId,
      txid: '9223372036854775807',
    },
    error: null,
  }))

  const { useTodoMutations } = await import('./useTodoMutations')

  useTodoMutations().createTodo('Keep xid8 exact', null)

  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(acceptMutation.mock.calls[0]?.[1].txid, '9223372036854775807')
  assert.deepEqual(awaitTxId.mock.calls[0], ['9223372036854775807'])
  assert.deepEqual(confirmTxid.mock.calls[0], ['9223372036854775807'])
})

test('useTodoMutations surfaces auth mutation failures as requires-reauth instead of generic retry work', async () => {
  rpc.mockImplementationOnce(async () => ({
    data: null,
    error: {
      code: '42501',
      details: 'new row violates row-level security policy',
      hint: 'Reauthenticate and retry.',
      message: 'JWT expired',
    },
  }))

  const { useTodoMutations } = await import('./useTodoMutations')

  useTodoMutations().createTodo('Auth expired write', null)

  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(markMutationRequiresReauth.mock.calls.length, 1)
  assert.equal(markMutationRetryableError.mock.calls.length, 0)
  assert.equal(markMutationRequiresReauth.mock.calls[0]?.[1], 'JWT expired')
})

test('useTodoMutations keeps accepted work out of retryable-error when txid confirmation fails', async () => {
  awaitTxId.mockImplementationOnce(async () => {
    throw new Error('txid confirmation timed out')
  })

  const { useTodoMutations } = await import('./useTodoMutations')

  useTodoMutations().createTodo('Accepted but unconfirmed', null)

  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(acceptMutation.mock.calls.length, 1)
  assert.equal(markMutationRetryableError.mock.calls.length, 0)
  assert.equal(pendingMutations.value[0]?.status, 'accepted-awaiting-sync')
  assert.equal(pendingMutations.value[0]?.accepted?.txid, '42')
})

test('useTodoMutations leaves optimistic work queued when transport cannot send', async () => {
  transportState.value = {
    canSend: false,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: false,
    requiresReauth: false,
  }

  const { useTodoMutations } = await import('./useTodoMutations')

  useTodoMutations().createTodo('Queue offline work', null)
  await Promise.resolve()

  assert.equal(recordPendingMutation.mock.calls.length, 1)
  assert.equal(markMutationSending.mock.calls.length, 0)
  assert.equal(rpc.mock.calls.length, 0)
})

test('useTodoMutations cancels a guest optimistic create when it is deleted before confirmation', async () => {
  activeUserId.value = null
  transportState.value = {
    canSend: false,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: false,
    requiresReauth: false,
  }

  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Guest draft', null)
  mutations.deleteTodo(todoId)

  await Promise.resolve()

  assert.equal(pendingMutations.value.length, 0)
  assert.equal(rpc.mock.calls.length, 0)
})

test('useTodoMutations cancels an authenticated optimistic create before it reaches the confirmed baseline', async () => {
  transportState.value = {
    canSend: false,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: false,
    requiresReauth: false,
  }

  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Offline create', null)
  mutations.deleteTodo(todoId)

  await Promise.resolve()

  assert.equal(pendingMutations.value.length, 0)
  assert.deepEqual(
    recordPendingMutation.mock.calls.map((call) => call[0].intent.kind),
    ['create'],
  )
})

test('useTodoMutations replaces an accepted optimistic create with a delete before Electric confirms it', async () => {
  awaitTxId.mockImplementation(async (...args: unknown[]) => args[0] !== '42')
  rpc.mockImplementationOnce(async (_fn, args) => ({
    data: {
      mutationId: args.intent.mutationId,
      todoId: args.intent.todoId,
      txid: 42,
    },
    error: null,
  }))
  rpc.mockImplementationOnce(async (_fn, args) => ({
    data: {
      mutationId: args.intent.mutationId,
      todoId: args.intent.todoId,
      txid: 43,
    },
    error: null,
  }))

  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Needs delete', null)

  await Promise.resolve()
  await Promise.resolve()

  mutations.deleteTodo(todoId)

  await Promise.resolve()
  await Promise.resolve()

  assert.equal(rpc.mock.calls.length, 1)
  assert.equal(rpc.mock.calls[0][1].intent.kind, 'create')
  assert.equal(pendingMutations.value.length, 2)
  assert.equal(pendingMutations.value[0]?.intent.kind, 'create')
  assert.equal(pendingMutations.value[0]?.accepted?.txid, '42')
  assert.equal(pendingMutations.value[1]?.intent.kind, 'delete')
  assert.deepEqual(
    buildTodoOverlay({
      confirmedTodos: confirmedTodos.value,
      pendingMutations: pendingMutations.value,
    }),
    [],
  )

  confirmedTodos.value = [
    {
      id: todoId,
      label: 'Needs delete',
      weekNumber: null,
      done: false,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
  ]

  await mutations.flushPendingMutations()

  assert.equal(rpc.mock.calls.length, 2)
  assert.equal(rpc.mock.calls[1][1].intent.kind, 'delete')

  assert.deepEqual(
    buildTodoOverlay({
      confirmedTodos: confirmedTodos.value,
      pendingMutations: pendingMutations.value,
    }),
    [],
  )
})

test('useTodoMutations keeps an in-flight authenticated create while queuing a follow-up delete until a baseline exists', async () => {
  awaitTxId.mockImplementation(async (...args: unknown[]) => args[0] !== '42')

  const createRpcGate: { release: null | (() => void) } = { release: null }
  const createRpcReady = new Promise<void>((resolve) => {
    createRpcGate.release = resolve
  })

  rpc.mockImplementationOnce(async (_fn, args) => {
    await createRpcReady

    return {
      data: {
        mutationId: args.intent.mutationId,
        todoId: args.intent.todoId,
        txid: 42,
      },
      error: null,
    }
  })
  rpc.mockImplementationOnce(async (_fn, args) => ({
    data: {
      mutationId: args.intent.mutationId,
      todoId: args.intent.todoId,
      txid: 43,
    },
    error: null,
  }))

  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Needs delete after send', null)

  await Promise.resolve()

  mutations.deleteTodo(todoId)

  await Promise.resolve()

  assert.equal(rpc.mock.calls.length, 1)
  assert.equal(pendingMutations.value.length, 2)
  assert.equal(pendingMutations.value[0]?.intent.kind, 'create')
  assert.equal(pendingMutations.value[0]?.status, 'sending')
  assert.equal(pendingMutations.value[1]?.intent.kind, 'delete')
  assert.equal(pendingMutations.value[1]?.status, 'queued')
  assert.deepEqual(
    buildTodoOverlay({
      confirmedTodos: confirmedTodos.value,
      pendingMutations: pendingMutations.value,
    }),
    [],
  )

  if (!createRpcGate.release) {
    throw new Error('Expected create RPC resolver to be captured before resolving it')
  }

  createRpcGate.release()

  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(rpc.mock.calls.length, 1)
  assert.equal(pendingMutations.value[0]?.intent.kind, 'create')
  assert.equal(pendingMutations.value[0]?.status, 'accepted-awaiting-sync')
  assert.equal(pendingMutations.value[0]?.accepted?.txid, '42')
  assert.equal(pendingMutations.value[1]?.intent.kind, 'delete')
  assert.equal(pendingMutations.value[1]?.status, 'queued')

  await mutations.flushPendingMutations()

  assert.equal(rpc.mock.calls.length, 1)

  confirmedTodos.value = [
    {
      id: todoId,
      label: 'Needs delete after send',
      weekNumber: null,
      done: false,
      archived: false,
      createdAt: pendingMutations.value[0]!.optimisticTodo!.createdAt,
      updatedAt: pendingMutations.value[0]!.optimisticTodo!.updatedAt,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
  ]

  await mutations.flushPendingMutations()

  assert.equal(rpc.mock.calls.length, 2)
  assert.equal(rpc.mock.calls[1]?.[1].intent.kind, 'delete')
})

test('useTodoMutations coalesces queued authenticated create updates so confirmed baseline keeps the edited fields', async () => {
  transportState.value = {
    canSend: false,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: false,
    requiresReauth: false,
  }

  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Draft label', null)
  mutations.updateTodo(todoId, { label: 'Edited label', weekNumber: 14 })

  assert.equal(pendingMutations.value.length, 1)
  assert.equal(pendingMutations.value[0]?.intent.kind, 'create')
  assert.equal(pendingMutations.value[0]?.optimisticTodo?.label, 'Edited label')
  assert.equal(
    pendingMutations.value[0]?.intent.kind === 'create'
      ? pendingMutations.value[0].intent.values.label
      : undefined,
    'Edited label',
  )

  confirmedTodos.value = [
    {
      id: todoId,
      label: 'Edited label',
      weekNumber: 14,
      done: false,
      archived: false,
      createdAt: pendingMutations.value[0]!.optimisticTodo!.createdAt,
      updatedAt: pendingMutations.value[0]!.optimisticTodo!.updatedAt,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
  ]

  assert.deepEqual(
    buildTodoOverlay({
      confirmedTodos: confirmedTodos.value,
      pendingMutations: pendingMutations.value,
    }),
    confirmedTodos.value,
  )
})

test('useTodoMutations preserves accepted create txid metadata and queues a follow-up update before confirmation', async () => {
  awaitTxId.mockImplementation(() => new Promise<boolean>(() => {}))
  rpc.mockImplementation(async (_fn, args) => ({
    data: {
      mutationId: args.intent.mutationId,
      todoId: args.intent.todoId,
      txid: 42,
    },
    error: null,
  }))

  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Original label', null)

  await Promise.resolve()
  await Promise.resolve()

  mutations.updateTodo(todoId, { label: 'Edited after acceptance' })

  await Promise.resolve()

  assert.equal(pendingMutations.value.length, 2)
  assert.equal(pendingMutations.value[0]?.intent.kind, 'create')
  assert.equal(pendingMutations.value[0]?.status, 'accepted-awaiting-sync')
  assert.equal(pendingMutations.value[0]?.accepted?.txid, '42')
  assert.equal(pendingMutations.value[1]?.intent.kind, 'update')
  assert.equal(
    pendingMutations.value[1]?.intent.kind === 'update'
      ? pendingMutations.value[1].intent.values.label
      : undefined,
    'Edited after acceptance',
  )
})

test('useTodoMutations collapses a guest create update delete chain with no confirmed baseline', async () => {
  activeUserId.value = null
  transportState.value = {
    canSend: false,
    hasInvariantViolations: false,
    isAuthReady: true,
    isOnline: false,
    requiresReauth: false,
  }

  const { useTodoMutations } = await import('./useTodoMutations')

  const mutations = useTodoMutations()
  const todoId = mutations.createTodo('Guest draft', null)
  mutations.updateTodo(todoId, { label: 'Guest revision' })
  mutations.deleteTodo(todoId)

  assert.deepEqual(pendingMutations.value, [])
})
