import { readFile } from 'node:fs/promises'
import { computed, createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const routePath = '/backlog'
const addTodo = vi.fn()
const keepMigration = vi.fn()
const declineMigration = vi.fn()
const migrationCanDecline = ref(true)
const migrationCanKeep = ref(true)
const migrationKeepDisabledReason = ref<string | null>(null)
const migrationStagedTodoCount = ref(0)
const migrationStatus = ref<'none' | 'available' | 'promoting' | 'declined'>('none')
const canCreateTodos = ref(true)
const createTodoDisabledReason = ref<string | null>(null)

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
    migration: computed(() => ({
      canDecline: migrationCanDecline.value,
      canKeep: migrationCanKeep.value,
      decline: declineMigration,
      keep: keepMigration,
      keepDisabledReason: migrationKeepDisabledReason.value,
      stagedTodoCount: migrationStagedTodoCount.value,
      status: migrationStatus.value,
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
  keepMigration.mockReset()
  declineMigration.mockReset()
  migrationCanDecline.value = true
  migrationCanKeep.value = true
  migrationKeepDisabledReason.value = null
  migrationStagedTodoCount.value = 0
  migrationStatus.value = 'none'
  canCreateTodos.value = true
  createTodoDisabledReason.value = null
})

test('App renders the available migration branch with a disabled keep button reason when keep is gated', async () => {
  migrationStatus.value = 'available'
  migrationStagedTodoCount.value = 2
  migrationCanKeep.value = false
  migrationKeepDisabledReason.value = 'Sign in with the approved account to keep staged todos.'

  const html = await renderApp()

  assert.match(html, /2 staged tasks are ready to keep in this account\./)
  assert.match(
    html,
    /Signed-out users stay in migration review until the approved account signs in and keeps the staged tasks\./,
  )
  assert.match(html, /Keep staged tasks/)
  assert.match(html, /disabled/)
  assert.match(html, /Sign in with the approved account to keep staged todos\./)
})

test('App renders the promoting and declined migration branches reliably', async () => {
  migrationStatus.value = 'promoting'

  const promotingHtml = await renderApp()

  assert.match(
    promotingHtml,
    /Migration is in progress\. Staged tasks will appear after sync confirms them\./,
  )

  vi.resetModules()
  migrationStatus.value = 'declined'

  const declinedHtml = await renderApp()

  assert.match(
    declinedHtml,
    /Staged legacy\/imported tasks were declined and remain quarantined outside the synced view\./,
  )
})

test('App does not advertise a keep action when available migration rows are deleted-only', async () => {
  migrationStatus.value = 'available'
  migrationStagedTodoCount.value = 0
  migrationCanKeep.value = false
  migrationKeepDisabledReason.value = null

  const html = await renderApp()

  assert.match(html, /No staged tasks are available to keep\./)
  assert.equal(/Keep staged tasks/.test(html), false)
})

test('App default migration message requires sign-in and keeping staged tasks', async () => {
  migrationStatus.value = 'none'

  const html = await renderApp()

  assert.match(
    html,
    /Imports stage tasks for migration review before sync\. Signed-out access is limited to migration review until the approved account signs in and keeps the staged tasks\./,
  )
})

test('App does not auto-clear validation errors with a timeout', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

  assert.equal(source.includes('setTimeout(() => {'), false)
})
