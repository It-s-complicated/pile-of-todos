import { nextTick, ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { afterEach, assert, test, vi } from 'vite-plus/test'

const approvedGithubProviderId = 'github-user-42'
const signInWithGithub = vi.fn()
const signOut = vi.fn(async () => {})
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
  getApprovedGithubProviderId: () => approvedGithubProviderId,
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

test('useAuth signs out denied authenticated users before they can stay on synced paths', async () => {
  setSession({
    access_token: 'token-denied',
    user: {
      id: 'user-denied',
      email: 'denied@example.com',
      identities: [
        {
          provider: 'github',
          provider_id: 'github-user-99',
        },
      ],
      user_metadata: {
        user_name: 'Denied User',
      },
    } as unknown as Session['user'],
  } as Session)

  const { useAuth } = await import('./useAuth')
  const auth = useAuth()

  assert.equal(auth.accessState.value, 'denied')

  await nextTick()

  assert.equal(signOut.mock.calls.length, 1)
})
