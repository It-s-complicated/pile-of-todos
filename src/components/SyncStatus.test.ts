import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const acceptedMutationCount = ref(0)
const canRetrySync = ref(false)
const degraded = ref<'none' | 'requires-reauth' | 'retryable-error'>('none')
const isOnline = ref(true)
const queuedMutationCount = ref(0)
const sync = ref<'awaiting-confirmation' | 'paused' | 'queued-offline' | 'syncing' | 'synced'>(
  'synced',
)

vi.mock('@lucide/vue', () => ({
  RefreshCcw: defineComponent({
    name: 'IconStub',
    setup: () => () => h('span'),
  }),
}))

vi.mock('@/composables/useTodos', () => ({
  useTodos: () => ({ isOnline, statuses: { degraded, sync } }),
}))

vi.mock('@/composables/useTodoSync', () => ({
  useTodoSync: () => ({
    acceptedMutationCount,
    canRetrySync,
    queuedMutationCount,
    syncTodos: vi.fn<() => Promise<boolean>>(async () => true),
  }),
}))

async function renderSyncStatus() {
  const { default: SyncStatus } = await import('./SyncStatus.vue')
  return renderToString(createSSRApp(SyncStatus))
}

beforeEach(() => {
  acceptedMutationCount.value = 0
  canRetrySync.value = false
  degraded.value = 'none'
  isOnline.value = true
  queuedMutationCount.value = 0
  sync.value = 'synced'
})

test('SyncStatus politely announces routine changes and alerts for blocking errors', async () => {
  assert.match(await renderSyncStatus(), /role="status" aria-live="polite" aria-atomic="true"/)

  degraded.value = 'requires-reauth'

  assert.match(await renderSyncStatus(), /role="alert" aria-live="assertive" aria-atomic="true"/)
})
