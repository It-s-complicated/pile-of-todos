import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const queuedCreateCount = ref(0)

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    accessState: computed(() => 'approved'),
    isAuthReady: computed(() => true),
    isAuthenticated: computed(() => true),
    session: computed(() => null),
    userId: computed(() => 'user-a'),
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
    todos: computed(() => []),
  }),
}))

vi.mock('./useTodoCreateQueueController', () => ({
  useTodoCreateQueueController: () => ({
    clearSyncError: vi.fn(),
    flushQueuedCreates: vi.fn(async () => true),
    isFlushing: ref(false),
    lastError: ref<string | null>(null),
    markRequiresReauth: vi.fn(),
    queuedCreateCount: computed(() => queuedCreateCount.value),
    queuedCreates: computed(() => []),
    queueCreate: vi.fn(),
    reloadQueuedCreates: vi.fn(),
    transportState: computed(() => ({
      canFlush: true,
      isAuthReady: true,
      isOnline: true,
      requiresReauth: false,
    })),
  }),
}))

beforeEach(() => {
  vi.resetModules()
  queuedCreateCount.value = 0
})

test('useTodoData exposes approved auth state and the Electric read model', async () => {
  const { useTodoData } = await import('./useTodoData')

  const todoData = useTodoData()

  assert.equal(todoData.auth.accessState.value, 'approved')
  assert.equal(todoData.auth.activeUserId.value, 'user-a')
  assert.equal(todoData.connectivity.isReady.value, true)
  assert.equal(todoData.readModel.todos.value.length, 0)
})

test('useTodoData exposes the shared offline create queue controller', async () => {
  queuedCreateCount.value = 2

  const { useTodoData } = await import('./useTodoData')

  const todoData = useTodoData()

  assert.equal(todoData.sync.controller.queuedCreateCount.value, 2)
})
