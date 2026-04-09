import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const authError = ref<string | null>(null)
const displayName = ref<string | null>(null)
const isAuthenticated = ref(false)
const user = ref<{ email?: string | null } | null>(null)
const signInWithGithub = vi.fn(async () => undefined)
const signOut = vi.fn(async () => undefined)

vi.mock('lucide-vue-next', () => {
  const icon = defineComponent({
    name: 'IconStub',
    setup() {
      return () => h('span')
    },
  })

  return {
    CircleUserRound: icon,
    Github: icon,
    LogOut: icon,
  }
})

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authError,
    displayName,
    isAuthenticated,
    signInWithGithub,
    signOut,
    user,
  }),
}))

async function renderAuthStatus(props?: { showDetailsOnMobile?: boolean }) {
  const { default: AuthStatus } = await import('./AuthStatus.vue')
  const app = createSSRApp(AuthStatus, props)

  return renderToString(app)
}

beforeEach(() => {
  vi.resetModules()
  authError.value = null
  displayName.value = null
  isAuthenticated.value = false
  user.value = null
  signInWithGithub.mockReset()
  signOut.mockReset()
})

test('AuthStatus keeps account details hidden on mobile by default', async () => {
  const html = await renderAuthStatus()

  assert.match(html, /class="hidden min-w-0 sm:block"/)
  assert.match(html, /Sign in to start account sync/)
  assert.match(html, />Sign in</)
})

test('AuthStatus reveals account details on mobile when requested for the overflow panel', async () => {
  isAuthenticated.value = true
  displayName.value = 'Ada Lovelace'
  user.value = { email: 'ada@example.com' }

  const html = await renderAuthStatus({ showDetailsOnMobile: true })

  assert.match(html, /class="block min-w-0 sm:block"/)
  assert.match(html, /Signed in as/)
  assert.match(html, /Ada Lovelace/)
  assert.match(html, />Sign out</)
})
