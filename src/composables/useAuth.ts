import { computed } from 'vue'
import type { User } from '@supabase/supabase-js'

import { getAuthAccessState, getGithubProviderId } from '@/lib/auth-allowlist'
import {
  getApprovedGithubProviderId,
  signInWithGithub,
  signOut,
  useSupabaseAuthState,
} from '@/lib/supabase'

function getUserDisplayName(user: User | null): string | null {
  if (!user) {
    return null
  }

  const metadata = user.user_metadata

  return (
    metadata?.user_name || metadata?.preferred_username || metadata?.name || user.email || user.id
  )
}

const approvedGithubProviderId = getApprovedGithubProviderId()

export function useAuth() {
  const { isReady, session, user, userId, authError: supabaseAuthError } = useSupabaseAuthState()

  const isAuthenticated = computed(() => session.value !== null)
  const githubProviderId = computed(() => getGithubProviderId(user.value?.identities))
  const accessState = computed(() =>
    getAuthAccessState({
      isAuthenticated: isAuthenticated.value,
      githubProviderId: githubProviderId.value,
      approvedGithubProviderId,
    }),
  )

  const authError = computed(() => {
    if (accessState.value === 'denied') {
      return 'This GitHub account is not approved for sync access.'
    }

    return supabaseAuthError.value
  })

  return {
    session,
    user,
    userId,
    displayName: computed(() => getUserDisplayName(user.value)),
    githubProviderId,
    approvedGithubProviderId,
    isAuthenticated,
    isAuthReady: isReady,
    authError,
    accessState,
    signInWithGithub,
    signOut,
  }
}
