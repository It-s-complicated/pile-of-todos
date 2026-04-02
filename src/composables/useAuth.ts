import { computed, watch } from 'vue'
import type { User } from '@supabase/supabase-js'

import { getAuthSyncAccess, getGithubProviderId } from '@/lib/auth-allowlist'
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
let deniedAccountSignOutPromise: Promise<void> | null = null

function signOutDeniedAccount() {
  if (deniedAccountSignOutPromise) {
    return deniedAccountSignOutPromise
  }

  deniedAccountSignOutPromise = signOut()
    .catch(() => undefined)
    .finally(() => {
      deniedAccountSignOutPromise = null
    })

  return deniedAccountSignOutPromise
}

export function useAuth() {
  const { isReady, session, user, userId, authError: supabaseAuthError } = useSupabaseAuthState()

  const isAuthenticated = computed(() => session.value !== null)
  const githubProviderId = computed(() => getGithubProviderId(user.value?.identities))
  const syncAccess = computed(() =>
    getAuthSyncAccess({
      isAuthenticated: isAuthenticated.value,
      githubProviderId: githubProviderId.value,
      approvedGithubProviderId,
      userId: userId.value,
      accessToken: session.value?.access_token ?? null,
    }),
  )
  const accessState = computed(() => syncAccess.value.accessState)

  const authError = computed(() => {
    if (accessState.value === 'denied') {
      return 'This GitHub account is not approved for sync access.'
    }

    return supabaseAuthError.value
  })

  watch(
    () => ({
      accessState: accessState.value,
      isAuthReady: isReady.value,
      isAuthenticated: isAuthenticated.value,
    }),
    ({ accessState: nextAccessState, isAuthReady, isAuthenticated: nextIsAuthenticated }) => {
      if (!isAuthReady || !nextIsAuthenticated || nextAccessState !== 'denied') {
        return
      }

      void signOutDeniedAccount()
    },
    { immediate: true },
  )

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
