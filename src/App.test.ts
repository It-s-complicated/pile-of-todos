import { computed, createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

let routePath = '/backlog'
const addTodo = vi.fn<(label: string, weekNumber: number | null, id?: string) => Promise<string>>(
  async () => 'todo-a',
)
const canCreateTodos = ref(true)
const createTodoDisabledReason = ref<string | null>(null)
const isOnline = ref(true)
const acceptedCount = ref(0)
const queuedCount = ref(0)
const queueError = ref<string | null>(null)
const isFlushing = ref(false)

vi.mock('@lucide/vue', () => {
  const icon = defineComponent({
    name: 'IconStub',
    setup() {
      return () => h('span')
    },
  })

  return {
    Archive: icon,
    Calendar: icon,
    CheckCircle: icon,
    Clock: icon,
    Inbox: icon,
    Layers: icon,
    Menu: icon,
    X: icon,
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: routePath,
  }),
  useRouter: () => ({
    push: vi.fn<(to: unknown) => Promise<void>>(),
  }),
}))

vi.mock('./components/AuthStatus.vue', () => ({
  default: defineComponent({
    name: 'AuthStatusStub',
    setup() {
      return () => h('div', 'Auth status')
    },
  }),
}))

vi.mock('./components/SyncStatus.vue', () => ({
  default: defineComponent({
    name: 'SyncStatusStub',
    setup() {
      return () => h('div', 'Sync status')
    },
  }),
}))

vi.mock('@/lib/get-current-week-number', () => ({
  getCurrentWeekNumber: () => 14,
}))

vi.mock('./composables/useElectricTodos', () => ({
  useElectricTodos: () => ({
    addTodo,
    canCreateTodos: computed(() => canCreateTodos.value),
    createTodoDisabledReason: computed(() => createTodoDisabledReason.value),
    isOnline: computed(() => isOnline.value),
    offlineQueue: computed(() => ({
      acceptedCount: acceptedCount.value,
      count: queuedCount.value,
      isFlushing: isFlushing.value,
      lastError: queueError.value,
      queuedCount: queuedCount.value - acceptedCount.value,
    })),
  }),
}))

async function renderApp() {
  const { default: App } = await import('./App.vue')
  const app = createSSRApp(App)

  app.component(
    'RouterLink',
    defineComponent({
      name: 'RouterLinkStub',
      props: {
        to: {
          required: false,
          type: [Object, String],
        },
      },
      setup(_props, { slots }) {
        return () => h('a', slots.default?.())
      },
    }),
  )
  app.component(
    'RouterView',
    defineComponent({
      name: 'RouterViewStub',
      setup() {
        return () => h('div', 'Route content')
      },
    }),
  )

  return renderToString(app)
}

beforeEach(() => {
  vi.resetModules()
  routePath = '/backlog'
  addTodo.mockReset()
  addTodo.mockResolvedValue('todo-a')
  canCreateTodos.value = true
  createTodoDisabledReason.value = null
  isOnline.value = true
  acceptedCount.value = 0
  queuedCount.value = 0
  queueError.value = null
  isFlushing.value = false
})

test('App explains pending changes waiting locally', async () => {
  isOnline.value = false
  queuedCount.value = 2

  const html = await renderApp()

  assert.match(html, /2 pending changes will sync when the connection returns\./)
})

test('App explains queue flushing and shows queue errors', async () => {
  queuedCount.value = 1
  isFlushing.value = true
  queueError.value = 'Queue replay failed'

  const html = await renderApp()

  assert.match(
    html,
    /Pending changes are being written and confirmed against the live Electric stream\./,
  )
  assert.match(html, /Queue replay failed/)
})

test('App defaults to the merged-model sync explanation when nothing is queued', async () => {
  const html = await renderApp()

  assert.match(
    html,
    /Todo views merge the confirmed Electric baseline with a local pending overlay/,
  )
})

test('App renders weekly planning links and a collapsed More views trigger', async () => {
  routePath = '/archived'

  const html = await renderApp()

  assert.match(html, /Pile[\s\S]*Backlog[\s\S]*Current[\s\S]*Future[\s\S]*Unfinished/)
  assert.match(html, /aria-controls="more-views-panel"/)
  assert.match(html, /More views/)
  assert.notMatch(html, /Completed/)
  assert.notMatch(html, /Archived/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-label="Open more views"/)
})

test('App keeps the offline queue default copy unchanged in SSR output', async () => {
  const html = await renderApp()

  assert.match(
    html,
    /Todo views merge the confirmed Electric baseline with a local pending overlay until each accepted txid is confirmed\./,
  )
})

test('App explains accepted changes awaiting Electric confirmation', async () => {
  acceptedCount.value = 1
  queuedCount.value = 1

  const html = await renderApp()

  assert.match(html, /1 accepted change awaiting Electric confirmation\./)
})
