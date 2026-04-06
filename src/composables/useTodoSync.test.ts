import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const queuedCreateCount = ref(0)
const isFlushing = ref(false)
const isOnline = ref(true)
const isReady = ref(true)
const lastError = ref<string | null>(null)
const requiresReauth = ref(false)

const flushQueuedCreates = vi.fn(async () => true)

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    connectivity: {
      isOnline,
      isReady,
    },
    sync: {
      controller: {
        flushQueuedCreates,
        isFlushing,
        lastError,
        queuedCreateCount: computed(() => queuedCreateCount.value),
        transportState: computed(() => ({
          canFlush: isOnline.value && !requiresReauth.value,
          isAuthReady: true,
          isOnline: isOnline.value,
          requiresReauth: requiresReauth.value,
        })),
      },
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  queuedCreateCount.value = 0
  isFlushing.value = false
  isOnline.value = true
  isReady.value = true
  lastError.value = null
  requiresReauth.value = false
  flushQueuedCreates.mockReset()
  flushQueuedCreates.mockResolvedValue(true)
})

test('useTodoSync reports queued-offline when queued creates are waiting locally', async () => {
  queuedCreateCount.value = 2
  isOnline.value = false
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'queued-offline')
  assert.equal(sync.hasPendingMutations.value, true)
})

test('useTodoSync reports retryable queue errors', async () => {
  queuedCreateCount.value = 1
  lastError.value = 'network lost'
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.degradedStatus.value, 'retryable-error')
  assert.equal(sync.canRetrySync.value, true)
})

test('useTodoSync reports reauth before ordinary queue state', async () => {
  queuedCreateCount.value = 1
  requiresReauth.value = true
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.degradedStatus.value, 'requires-reauth')
  assert.equal(sync.canRetrySync.value, false)
})

test('useTodoSync delegates retry work to the queue controller', async () => {
  queuedCreateCount.value = 1
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()
  await sync.syncTodos()

  assert.equal(flushQueuedCreates.mock.calls.length, 1)
})

test('useTodoSync reports syncing while queued creates are being flushed', async () => {
  queuedCreateCount.value = 1
  isFlushing.value = true
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'syncing')
})
