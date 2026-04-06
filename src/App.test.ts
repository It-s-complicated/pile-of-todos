import { readFile } from 'node:fs/promises'
import { computed, createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const routePath = '/backlog'
const addTodo = vi.fn(async () => 'todo-a')
const canCreateTodos = ref(true)
const createTodoDisabledReason = ref<string | null>(null)
const isOnline = ref(true)
const queuedCount = ref(0)
const queueError = ref<string | null>(null)
const isFlushing = ref(false)

vi.mock('lucide-vue-next', () => {
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
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: routePath,
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
      count: queuedCount.value,
      isFlushing: isFlushing.value,
      lastError: queueError.value,
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
  addTodo.mockReset()
  addTodo.mockResolvedValue('todo-a')
  canCreateTodos.value = true
  createTodoDisabledReason.value = null
  isOnline.value = true
  queuedCount.value = 0
  queueError.value = null
  isFlushing.value = false
})

test('App explains the offline queue when tasks are waiting locally', async () => {
  isOnline.value = false
  queuedCount.value = 2

  const html = await renderApp()

  assert.match(html, /2 queued tasks will be created in Supabase when the connection returns\./)
})

test('App explains queue flushing and shows queue errors', async () => {
  queuedCount.value = 1
  isFlushing.value = true
  queueError.value = 'Queue replay failed'

  const html = await renderApp()

  assert.match(
    html,
    /Queued tasks are being written to Supabase and will appear when Electric catches up\./,
  )
  assert.match(html, /Queue replay failed/)
})

test('App defaults to the remote-only sync explanation when nothing is queued', async () => {
  const html = await renderApp()

  assert.match(
    html,
    /Todo views come only from Electric live queries\. The app stores local data only for newly created offline tasks until it can write them to Supabase\./,
  )
})

test('App does not auto-clear validation errors with a timeout', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

  assert.equal(source.includes('setTimeout(() => {'), false)
})
