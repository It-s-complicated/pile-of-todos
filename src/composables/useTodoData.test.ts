import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const migrateLegacyBucketsToGuestMigrationInput = vi.fn()
const readMigrationInputTodos = vi.fn()
const readTodoMigrationState = vi.fn()
const subscribeToMigrationInputChanges = vi.fn(() => () => undefined)

vi.mock('@/lib/todo-storage', () => ({
  migrateLegacyBucketsToGuestMigrationInput,
  readMigrationInputTodos,
  readTodoMigrationState,
  subscribeToMigrationInputChanges,
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    accessState: computed(() => 'signed-out'),
    isAuthReady: computed(() => true),
    isAuthenticated: computed(() => false),
    userId: computed(() => null),
  }),
}))

vi.mock('./useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: computed(() => true),
  }),
}))

vi.mock('./useTodoReadModel', () => ({
  useTodoReadModel: () => ({
    confirmedTodos: computed(() => []),
    isReady: ref(true),
    pendingMutations: ref([]),
    todos: computed(() => []),
  }),
}))

vi.mock('./useTodoSyncController', () => ({
  useTodoSyncController: () => ({
    pendingMutations: ref([]),
  }),
}))

beforeEach(() => {
  vi.resetModules()
  migrateLegacyBucketsToGuestMigrationInput.mockReset()
  readMigrationInputTodos.mockReset()
  readTodoMigrationState.mockReset()
  subscribeToMigrationInputChanges.mockReset()
  subscribeToMigrationInputChanges.mockReturnValue(() => undefined)
  readMigrationInputTodos.mockReturnValue([])
  readTodoMigrationState.mockReturnValue({
    promotedTodoIdsBySourceId: {},
    stagedTodos: [],
    status: 'none',
  })
})

test('useTodoData fails soft when legacy migration bootstrap throws', async () => {
  migrateLegacyBucketsToGuestMigrationInput.mockImplementation(() => {
    throw new Error('broken localStorage payload')
  })

  const { useTodoData } = await import('./useTodoData')

  const todoData = useTodoData()

  assert.equal(todoData.legacyGuest.guestTodoCount.value, 0)
  assert.equal(todoData.legacyGuest.hasGuestTodos.value, false)
})

test('useTodoData exposes available staged migration state', async () => {
  readMigrationInputTodos.mockReturnValue([
    {
      id: 'legacy-a',
      label: 'Imported todo',
      weekNumber: null,
      done: false,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
      deviceId: null,
      userId: null,
      deletedAt: null,
    },
  ])
  readTodoMigrationState.mockReturnValue({
    promotedTodoIdsBySourceId: {},
    stagedTodos: [
      {
        id: 'legacy-a',
        label: 'Imported todo',
        weekNumber: null,
        done: false,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
        deviceId: null,
        userId: null,
        deletedAt: null,
      },
    ],
    status: 'available',
  })

  const { useTodoData } = await import('./useTodoData')

  const todoData = useTodoData()

  assert.equal(todoData.migration.status.value, 'available')
  assert.equal(todoData.migration.stagedTodoCount.value, 1)
  assert.equal(todoData.migration.isAvailable.value, true)
})

test('useTodoData exposes promoting and declined staged migration state cleanly', async () => {
  readTodoMigrationState.mockReturnValue({
    promotedTodoIdsBySourceId: {
      'legacy-a': '11111111-1111-4111-8111-111111111111',
    },
    stagedTodos: [
      {
        id: 'legacy-a',
        label: 'Imported todo',
        weekNumber: null,
        done: false,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
        deviceId: null,
        userId: null,
        deletedAt: null,
      },
    ],
    status: 'promoting',
  })

  const { useTodoData } = await import('./useTodoData')

  const todoData = useTodoData()

  assert.equal(todoData.migration.status.value, 'promoting')
  assert.equal(todoData.migration.isPromoting.value, true)
  assert.equal(todoData.migration.isDeclined.value, false)
})
