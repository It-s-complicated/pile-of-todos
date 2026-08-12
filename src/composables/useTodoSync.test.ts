import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const acceptedMutationCount = ref(0)
const isFlushing = ref(false)
const isOnline = ref(true)
const isReady = ref(true)
const lastErrorKind = ref<'none' | 'requires-reauth' | 'retryable'>('none')
const pendingMutationCount = ref(0)
const requiresReauth = ref(false)
const queuedMutationCount = ref(0)

const flushPendingMutations = vi.fn<() => Promise<boolean>>(async () => true)

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    connectivity: {
      isOnline,
      isReady,
    },
    sync: {
      controller: {
        acceptedMutationCount: computed(() => acceptedMutationCount.value),
        flushPendingMutations,
        isFlushing,
        lastError: computed(() => null),
        lastErrorKind,
        pendingMutationCount: computed(() => pendingMutationCount.value),
        queuedMutationCount: computed(() => queuedMutationCount.value),
        transportState: computed(() => ({
          acceptedMutationCount: acceptedMutationCount.value,
          canFlush: isOnline.value && !requiresReauth.value,
          hasAcceptedPending: acceptedMutationCount.value > 0,
          hasQueuedPending: queuedMutationCount.value > 0,
          isAuthReady: true,
          isOnline: isOnline.value,
          lastErrorKind: lastErrorKind.value,
          requiresReauth: requiresReauth.value,
        })),
      },
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  acceptedMutationCount.value = 0
  isFlushing.value = false
  isOnline.value = true
  isReady.value = true
  lastErrorKind.value = 'none'
  pendingMutationCount.value = 0
  requiresReauth.value = false
  queuedMutationCount.value = 0
  flushPendingMutations.mockReset()
  flushPendingMutations.mockResolvedValue(true)
})

test('useTodoSync reports queued-offline when queued mutations are waiting locally', async () => {
  pendingMutationCount.value = 2
  queuedMutationCount.value = 2
  isOnline.value = false
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'queued-offline')
  assert.equal(sync.hasPendingMutations.value, true)
})

test('useTodoSync reports retryable queue errors', async () => {
  pendingMutationCount.value = 1
  queuedMutationCount.value = 1
  lastErrorKind.value = 'retryable'
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.degradedStatus.value, 'retryable-error')
  assert.equal(sync.canRetrySync.value, true)
})

test('useTodoSync reports reauth before ordinary queue state', async () => {
  pendingMutationCount.value = 1
  queuedMutationCount.value = 1
  lastErrorKind.value = 'requires-reauth'
  requiresReauth.value = true
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.degradedStatus.value, 'requires-reauth')
  assert.equal(sync.canRetrySync.value, false)
})

test('useTodoSync delegates retry work to the queue controller', async () => {
  pendingMutationCount.value = 1
  queuedMutationCount.value = 1
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()
  await sync.syncTodos()

  assert.equal(flushPendingMutations.mock.calls.length, 1)
})

test('useTodoSync reports syncing while pending mutations are being flushed', async () => {
  pendingMutationCount.value = 1
  queuedMutationCount.value = 1
  isFlushing.value = true
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'syncing')
})

test('useTodoSync reports accepted mutations awaiting a confirmed snapshot refresh', async () => {
  acceptedMutationCount.value = 1
  pendingMutationCount.value = 1
  const { useTodoSync } = await import('./useTodoSync')

  const sync = useTodoSync()

  assert.equal(sync.syncStatus.value, 'awaiting-confirmation')
  assert.equal(sync.acceptedMutationCount.value, 1)
})
