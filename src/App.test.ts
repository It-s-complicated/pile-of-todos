import { computed, createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type { LocationQuery } from 'vue-router'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

let routePath = '/backlog'
let routeQuery: LocationQuery = {}
const replace = vi.fn<(to: unknown) => Promise<void>>()
const isAuthReady = ref(true)
const isAuthenticated = ref(true)
const addTodo = vi.fn<(label: string, weekNumber: number | null, id?: string) => Promise<string>>(
  async () => 'todo-a',
)
const canCreateTodos = ref(true)
const createTodoDisabledReason = ref<string | null>(null)
const queueError = ref<string | null>(null)

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
    query: routeQuery,
    hash: '',
  }),
  useRouter: () => ({
    push: vi.fn<(to: unknown) => Promise<void>>(),
    replace,
  }),
}))

vi.mock('./composables/useAuth', () => ({
  useAuth: () => ({ isAuthReady, isAuthenticated }),
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

vi.mock('./composables/useTodos', () => ({
  useTodos: () => ({
    addTodo,
    canCreateTodos: computed(() => canCreateTodos.value),
    createTodoDisabledReason: computed(() => createTodoDisabledReason.value),
    offlineQueue: computed(() => ({
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
  routePath = '/backlog'
  routeQuery = {}
  isAuthReady.value = true
  isAuthenticated.value = true
  replace.mockReset()
  replace.mockResolvedValue(undefined)
  addTodo.mockReset()
  addTodo.mockResolvedValue('todo-a')
  canCreateTodos.value = true
  createTodoDisabledReason.value = null
  queueError.value = null
})

test('App shows offline queue errors when sync fails', async () => {
  queueError.value = 'Queue replay failed'

  const html = await renderApp()

  assert.match(html, /Sync error/)
  assert.match(html, /Queue replay failed/)
})

test('App hides save status copy when there is no queue error', async () => {
  const html = await renderApp()

  assert.notMatch(html, /Save Status/)
  assert.notMatch(html, /Sync error/)
  assert.notMatch(html, /Your task changes are saved automatically/)
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

test('waits for auth readiness before mounting the form or consuming a share URL', async () => {
  isAuthReady.value = false
  routeQuery = { share_text: 'Read https://example.com/' }

  const html = await renderApp()

  assert.notMatch(html, /<textarea/)
  assert.notMatch(html, /Auth status/)
  assert.equal(replace.mock.calls.length, 0)
  assert.equal(addTodo.mock.calls.length, 0)
})

test('keeps the share URL at sign-in and populates the form after returning authenticated', async () => {
  isAuthenticated.value = false
  routeQuery = { share_text: 'Read https://example.com/', keep: '1' }

  const signedOutHtml = await renderApp()
  assert.match(signedOutHtml, /Auth status/)
  assert.notMatch(signedOutHtml, /<textarea/)
  assert.equal(replace.mock.calls.length, 0)
  assert.equal(routeQuery.share_text, 'Read https://example.com/')

  // OAuth returns to the same URL, with the share parameters still present.
  isAuthenticated.value = true
  const signedInHtml = await renderApp()
  assert.match(signedInHtml, /<textarea[^>]*>Read https:\/\/example.com\//)
  assert.deepEqual(replace.mock.calls, [[{ query: { keep: '1' }, hash: '' }]])
  assert.equal(addTodo.mock.calls.length, 0)
})
