import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const accessState = ref<'approved' | 'signed-out' | 'denied'>('approved')
const isOnline = ref(true)
const queuedCreateCount = ref(0)

const createTodo = vi.fn()
const deleteTodo = vi.fn()
const restoreTodo = vi.fn()
const updateTodo = vi.fn()

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    auth: {
      accessState,
    },
    connectivity: {
      isOnline,
      isReady: computed(() => true),
    },
    readModel: {
      todos: computed(() => []),
    },
    sync: {
      controller: {
        isFlushing: computed(() => false),
        lastError: computed(() => null),
        queuedCreateCount: computed(() => queuedCreateCount.value),
      },
    },
  }),
}))

vi.mock('./useTodoMutations', () => ({
  useTodoMutations: () => ({
    createTodo,
    deleteTodo,
    restoreTodo,
    updateTodo,
  }),
}))

vi.mock('./useTodoSync', () => ({
  useTodoSync: () => ({
    degradedStatus: computed(() => 'none'),
    syncStatus: computed(() => 'synced'),
  }),
}))

beforeEach(() => {
  vi.resetModules()
  accessState.value = 'approved'
  isOnline.value = true
  queuedCreateCount.value = 0
  createTodo.mockReset()
  deleteTodo.mockReset()
  restoreTodo.mockReset()
  updateTodo.mockReset()
})

test('useElectricTodos allows creates for the approved account even while offline', async () => {
  isOnline.value = false
  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.canCreateTodos.value, true)
  assert.equal(todos.createTodoDisabledReason.value, null)
})

test('useElectricTodos blocks all writes when the approved account is missing', async () => {
  accessState.value = 'signed-out'
  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.canCreateTodos.value, false)
  assert.equal(todos.canMutateTodos.value, false)
  assert.equal(
    todos.createTodoDisabledReason.value,
    'Sign in with the approved account to create todos.',
  )
  assert.equal(
    todos.mutateTodoDisabledReason.value,
    'Sign in with the approved account to update todos.',
  )
})

test('useElectricTodos blocks non-create mutations while offline', async () => {
  isOnline.value = false
  queuedCreateCount.value = 2
  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.canMutateTodos.value, false)
  assert.equal(todos.mutateTodoDisabledReason.value, 'Reconnect to update todos.')
  assert.equal(todos.offlineQueue.value.count, 2)
})
