import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

import type { Todo } from '@/db/collections'

const activeUserId = ref<string | null>('user-a')
const confirmedTodos = ref<Todo[]>([])
const isOnline = ref(true)

const clearSyncError = vi.fn()
const markRequiresReauth = vi.fn()
const queueCreate = vi.fn()

const buildRemoteTodoRow = vi.fn((todo: Todo) => ({
  id: todo.id,
  label: todo.label,
}))
const upsertRemoteTodo = vi.fn()
const updateRemoteTodo = vi.fn()

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    auth: {
      activeUserId: computed(() => activeUserId.value),
    },
    connectivity: {
      isOnline,
    },
    readModel: {
      confirmedTodos: computed(() => confirmedTodos.value),
    },
    sync: {
      controller: {
        clearSyncError,
        markRequiresReauth,
        queueCreate,
      },
    },
  }),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ from: vi.fn() }),
}))

vi.mock('@/lib/todo-sync', async () => {
  const actual = await vi.importActual<typeof import('@/lib/todo-sync')>('@/lib/todo-sync')

  return {
    ...actual,
    buildRemoteTodoRow,
    updateRemoteTodo,
    upsertRemoteTodo,
  }
})

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

beforeEach(() => {
  vi.resetModules()
  activeUserId.value = 'user-a'
  confirmedTodos.value = [confirmedTodo]
  isOnline.value = true
  clearSyncError.mockReset()
  markRequiresReauth.mockReset()
  queueCreate.mockReset()
  buildRemoteTodoRow.mockClear()
  upsertRemoteTodo.mockReset()
  updateRemoteTodo.mockReset()
  upsertRemoteTodo.mockResolvedValue(confirmedTodo)
  updateRemoteTodo.mockResolvedValue(confirmedTodo)
})

test('useTodoMutations queues creates locally while offline', async () => {
  isOnline.value = false
  const { useTodoMutations } = await import('./useTodoMutations')

  const todoId = await useTodoMutations().createTodo('Queued todo', 12)

  assert.equal(queueCreate.mock.calls.length, 1)
  assert.equal(upsertRemoteTodo.mock.calls.length, 0)
  assert.equal(queueCreate.mock.calls[0]?.[0]?.label, 'Queued todo')
  assert.equal(queueCreate.mock.calls[0]?.[0]?.id, todoId)
})

test('useTodoMutations writes creates directly to Supabase while online', async () => {
  const { useTodoMutations } = await import('./useTodoMutations')

  await useTodoMutations().createTodo('Remote todo', 12)

  assert.equal(buildRemoteTodoRow.mock.calls.length, 1)
  assert.equal(upsertRemoteTodo.mock.calls.length, 1)
  assert.equal(clearSyncError.mock.calls.length, 1)
})

test('useTodoMutations rejects updates while offline because only creates may queue', async () => {
  isOnline.value = false
  const { useTodoMutations } = await import('./useTodoMutations')

  await assertOfflineUpdateError(useTodoMutations().updateTodo(confirmedTodo.id, { done: true }))
  assert.equal(updateRemoteTodo.mock.calls.length, 0)
})

test('useTodoMutations writes updates directly to Supabase while online', async () => {
  const { useTodoMutations } = await import('./useTodoMutations')

  await useTodoMutations().updateTodo(confirmedTodo.id, {
    done: true,
    weekNumber: null,
  })

  assert.equal(updateRemoteTodo.mock.calls.length, 1)
  assert.equal(updateRemoteTodo.mock.calls[0]?.[1]?.todoId, confirmedTodo.id)
  assert.equal(updateRemoteTodo.mock.calls[0]?.[1]?.activeUserId, 'user-a')
  assert.equal(updateRemoteTodo.mock.calls[0]?.[1]?.updates.done, true)
  assert.equal(updateRemoteTodo.mock.calls[0]?.[1]?.updates.weekNumber, null)
  assert.equal(clearSyncError.mock.calls.length, 1)
})

test('useTodoMutations marks reauth when a remote auth failure occurs', async () => {
  const { TodoRemoteWriteError } = await import('@/lib/todo-sync')
  upsertRemoteTodo.mockRejectedValueOnce(new TodoRemoteWriteError('JWT expired', 'auth'))
  const { useTodoMutations } = await import('./useTodoMutations')

  await assertRejectedWithMessage(useTodoMutations().createTodo('Remote todo', 12), /JWT expired/)
  assert.deepEqual(markRequiresReauth.mock.calls[0], ['JWT expired'])
})

async function assertOfflineUpdateError(promise: Promise<unknown>) {
  await assertRejectedWithMessage(promise, /while offline/)
}

async function assertRejectedWithMessage(promise: Promise<unknown>, pattern: RegExp) {
  try {
    await promise
    assert.fail('Expected promise to reject')
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), pattern)
  }
}
