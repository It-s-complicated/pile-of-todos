import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { afterEach, assert, test, vi } from 'vite-plus/test'

const signInWithGithub = vi.fn<() => Promise<void>>()
const signOut = vi.fn<() => Promise<void>>(async () => {})
const session = ref<Session | null>(null)
const user = ref<Session['user'] | null>(null)
const userId = ref<string | null>(null)
const isReady = ref(true)
const authError = ref<string | null>(null)

function setSession(nextSession: Session | null) {
  session.value = nextSession
  user.value = nextSession?.user ?? null
  userId.value = nextSession?.user.id ?? null
}

vi.mock('@/lib/supabase', () => ({
  signInWithGithub,
  signOut,
  useSupabaseAuthState: () => ({
    isReady,
    session,
    user,
    userId,
    authError,
  }),
}))

afterEach(() => {
  setSession(null)
  isReady.value = true
  authError.value = null
  vi.clearAllMocks()
  vi.resetModules()
})

test('useAuth treats a valid Supabase session as signed in', async () => {
  setSession({
    access_token: 'token-signed-in',
    user: {
      id: 'user-signed-in',
      email: 'signed-in@example.com',
      user_metadata: {
        user_name: 'Signed In User',
      },
    } as unknown as Session['user'],
  } as Session)

  const { useAuth } = await import('./useAuth')
  const auth = useAuth()

  assert.equal(auth.accessState.value, 'signed-in')
  assert.equal(auth.isAuthenticated.value, true)
  assert.equal(auth.displayName.value, 'Signed In User')
})

test('useAuth surfaces auth redirect errors from the Supabase auth state', async () => {
  authError.value = 'Access denied by auth hook'

  const { useAuth } = await import('./useAuth')
  const auth = useAuth()

  assert.equal(auth.accessState.value, 'signed-out')
  assert.equal(auth.authError.value, 'Access denied by auth hook')
})
