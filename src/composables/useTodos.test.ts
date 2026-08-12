import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
const isOnline = ref(true)
const acceptedMutationCount = ref(0)
const pendingMutationCount = ref(0)
const queuedMutationCount = ref(0)

const createTodo =
  vi.fn<(label: string, weekNumber: number | null, id?: string) => Promise<string>>()
const deleteTodo = vi.fn<(id: string) => Promise<void>>()
const restoreTodo = vi.fn<(id: string) => Promise<void>>()
const updateTodo = vi.fn<(id: string, updates: Record<string, unknown>) => Promise<void>>()

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
        acceptedMutationCount: computed(() => acceptedMutationCount.value),
        isFlushing: computed(() => false),
        lastError: computed(() => null),
        pendingMutationCount: computed(() => pendingMutationCount.value),
        queuedMutationCount: computed(() => queuedMutationCount.value),
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
  accessState.value = 'signed-in'
  isOnline.value = true
  acceptedMutationCount.value = 0
  pendingMutationCount.value = 0
  queuedMutationCount.value = 0
  createTodo.mockReset()
  deleteTodo.mockReset()
  restoreTodo.mockReset()
  updateTodo.mockReset()
})

test('useTodos allows creates for signed-in users even while offline', async () => {
  isOnline.value = false
  const { useTodos } = await import('./useTodos')

  const todos = useTodos()

  assert.equal(todos.canCreateTodos.value, true)
  assert.equal(todos.createTodoDisabledReason.value, null)
})

test('useTodos blocks all writes when there is no signed-in session', async () => {
  accessState.value = 'signed-out'
  const { useTodos } = await import('./useTodos')

  const todos = useTodos()

  assert.equal(todos.canCreateTodos.value, false)
  assert.equal(todos.canMutateTodos.value, false)
  assert.equal(todos.createTodoDisabledReason.value, 'Sign in to create todos.')
  assert.equal(todos.mutateTodoDisabledReason.value, 'Sign in to update todos.')
})

test('useTodos keeps mutations enabled offline and exposes pending queue state', async () => {
  isOnline.value = false
  acceptedMutationCount.value = 1
  pendingMutationCount.value = 2
  queuedMutationCount.value = 1
  const { useTodos } = await import('./useTodos')

  const todos = useTodos()

  assert.equal(todos.canMutateTodos.value, true)
  assert.equal(todos.mutateTodoDisabledReason.value, null)
  assert.equal(todos.offlineQueue.value.count, 2)
  assert.equal(todos.offlineQueue.value.acceptedCount, 1)
  assert.equal(todos.offlineQueue.value.queuedCount, 1)
})
