import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const pendingMutationCount = ref(0)

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    accessState: computed(() => 'signed-in'),
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
  useTodoMutationQueueController: () => ({
    clearSyncError: vi.fn<() => void>(),
    acceptedMutationCount: computed(() => 0),
    flushPendingMutations: vi.fn<() => Promise<boolean>>(async () => true),
    isFlushing: ref(false),
    lastError: ref<string | null>(null),
    lastErrorKind: ref<'none'>('none'),
    markRequiresReauth: vi.fn<(message: string) => void>(),
    pendingMutationCount: computed(() => pendingMutationCount.value),
    pendingMutations: computed(() => []),
    queueMutation: vi.fn<(mutation: unknown) => void>(),
    queuedMutationCount: computed(() => pendingMutationCount.value),
    reloadPendingMutations: vi.fn<() => void>(),
    transportState: computed(() => ({
      acceptedMutationCount: 0,
      canFlush: true,
      hasAcceptedPending: false,
      hasQueuedPending: pendingMutationCount.value > 0,
      isAuthReady: true,
      isOnline: true,
      lastErrorKind: 'none',
      requiresReauth: false,
    })),
  }),
}))

beforeEach(() => {
  vi.resetModules()
  pendingMutationCount.value = 0
})

test('useTodoData exposes signed-in auth state and the Electric read model', async () => {
  const { useTodoData } = await import('./useTodoData')

  const todoData = useTodoData()

  assert.equal(todoData.auth.accessState.value, 'signed-in')
  assert.equal(todoData.auth.activeUserId.value, 'user-a')
  assert.equal(todoData.connectivity.isReady.value, true)
  assert.equal(todoData.readModel.todos.value.length, 0)
})

test('useTodoData exposes the shared pending mutation queue controller', async () => {
  pendingMutationCount.value = 2

  const { useTodoData } = await import('./useTodoData')

  const todoData = useTodoData()

  assert.equal(todoData.sync.controller.pendingMutationCount.value, 2)
})
