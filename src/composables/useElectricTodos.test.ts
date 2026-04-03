import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const accessState = ref<'approved' | 'signed-out' | 'denied'>('approved')
const migrationStatus = ref<'none' | 'available' | 'promoting' | 'declined'>('none')
const stagedTodoCount = ref(0)
const stagedTodos = ref<Array<{ deletedAt: number | null }>>([])
const keepStagedMigrationTodos = vi.fn()
const declineStagedMigrationTodos = vi.fn()

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    auth: {
      accessState,
    },
    connectivity: {
      isOnline: computed(() => true),
      isReady: computed(() => true),
    },
    migration: {
      isAvailable: computed(() => migrationStatus.value === 'available'),
      isDeclined: computed(() => migrationStatus.value === 'declined'),
      isPromoting: computed(() => migrationStatus.value === 'promoting'),
      stagedTodoCount: computed(() => stagedTodoCount.value),
      state: computed(() => ({
        promotedTodoIdsBySourceId: {},
        stagedTodos: stagedTodos.value,
        status: migrationStatus.value,
      })),
      status: computed(() => migrationStatus.value),
    },
    readModel: {
      todos: computed(() => []),
    },
  }),
}))

vi.mock('./useTodoMutations', () => ({
  useTodoMutations: () => ({
    createTodo: vi.fn(),
    deleteTodo: vi.fn(),
    keepStagedMigrationTodos,
    restoreTodo: vi.fn(),
    updateTodo: vi.fn(),
  }),
}))

vi.mock('@/lib/todo-storage', () => ({
  declineStagedMigrationTodos,
}))

vi.mock('./useTodoSync', () => ({
  useTodoSync: () => ({
    degradedStatus: computed(() => 'none'),
    syncStatus: computed(() => 'idle'),
  }),
}))

beforeEach(() => {
  vi.resetModules()
  accessState.value = 'approved'
  migrationStatus.value = 'none'
  stagedTodoCount.value = 0
  stagedTodos.value = []
  keepStagedMigrationTodos.mockReset()
  declineStagedMigrationTodos.mockReset()
})

test('useElectricTodos reports that signed-out users cannot create todos', async () => {
  accessState.value = 'signed-out'
  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.canCreateTodos.value, false)
  assert.equal(
    todos.createTodoDisabledReason.value,
    'Sign in with the approved account to create todos.',
  )
})

test('useElectricTodos reports that approved users can create todos', async () => {
  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.canCreateTodos.value, true)
  assert.equal(todos.createTodoDisabledReason.value, null)
})

test('useElectricTodos exposes migration actions and pending status while staged data is available', async () => {
  migrationStatus.value = 'available'
  stagedTodoCount.value = 2
  stagedTodos.value = [{ deletedAt: null }, { deletedAt: null }]
  keepStagedMigrationTodos.mockReturnValue(['todo-a', 'todo-b'])

  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.statuses.migration.value, 'available')
  assert.equal(todos.migration.value.status, 'available')
  assert.equal(todos.migration.value.stagedTodoCount, 2)
  assert.equal(todos.migration.value.canKeep, true)
  assert.equal(todos.migration.value.canDecline, true)
  assert.equal(todos.migration.value.keepDisabledReason, null)
  assert.deepEqual(todos.migration.value.keep(), ['todo-a', 'todo-b'])
  todos.migration.value.decline()
  assert.equal(keepStagedMigrationTodos.mock.calls.length, 1)
  assert.equal(declineStagedMigrationTodos.mock.calls.length, 1)
})

test('useElectricTodos reports promoting and declined migration states cleanly', async () => {
  migrationStatus.value = 'promoting'
  stagedTodoCount.value = 1
  stagedTodos.value = [{ deletedAt: null }]

  const { useElectricTodos } = await import('./useElectricTodos')

  const promotingTodos = useElectricTodos()

  assert.equal(promotingTodos.statuses.migration.value, 'promoting')
  assert.equal(promotingTodos.migration.value.canKeep, false)
  assert.equal(promotingTodos.migration.value.canDecline, false)

  vi.resetModules()
  accessState.value = 'approved'
  migrationStatus.value = 'declined'
  stagedTodoCount.value = 1
  stagedTodos.value = [{ deletedAt: null }]

  const { useElectricTodos: useDeclinedElectricTodos } = await import('./useElectricTodos')

  const declinedTodos = useDeclinedElectricTodos()

  assert.equal(declinedTodos.statuses.migration.value, 'declined')
  assert.equal(declinedTodos.migration.value.canKeep, false)
  assert.equal(declinedTodos.migration.value.canDecline, false)
})

test('useElectricTodos exposes a keep-disabled reason when migration is available but auth is not approved', async () => {
  accessState.value = 'signed-out'
  migrationStatus.value = 'available'
  stagedTodoCount.value = 1
  stagedTodos.value = [{ deletedAt: null }]

  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.migration.value.canKeep, false)
  assert.equal(
    todos.migration.value.keepDisabledReason,
    'Sign in with the approved account to keep staged todos.',
  )
  assert.deepEqual(todos.migration.value.keep(), [])
})

test('useElectricTodos does not expose keep when available migration rows are deleted-only', async () => {
  migrationStatus.value = 'available'
  stagedTodoCount.value = 2
  stagedTodos.value = [{ deletedAt: 10 }, { deletedAt: 20 }]

  const { useElectricTodos } = await import('./useElectricTodos')

  const todos = useElectricTodos()

  assert.equal(todos.migration.value.status, 'available')
  assert.equal(todos.migration.value.stagedTodoCount, 0)
  assert.equal(todos.migration.value.canKeep, false)
  assert.equal(todos.migration.value.keepDisabledReason, null)
  assert.deepEqual(todos.migration.value.keep(), [])
})
