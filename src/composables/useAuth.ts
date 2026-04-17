import { computed } from 'vue'
import type { User } from '@supabase/supabase-js'

import { getAuthSyncAccess } from '@/lib/auth-allowlist'
import { signInWithGithub, signOut, useSupabaseAuthState } from '@/lib/supabase'

function getUserDisplayName(user: User | null): string | null {
  if (!user) {
    return null
  }

  const metadata = user.user_metadata

  return (
    metadata?.user_name || metadata?.preferred_username || metadata?.name || user.email || user.id
  )
}

export function useAuth() {
  const { isReady, session, user, userId, authError: supabaseAuthError } = useSupabaseAuthState()

  const isAuthenticated = computed(() => session.value !== null)
  const syncAccess = computed(() =>
    getAuthSyncAccess({
      isAuthenticated: isAuthenticated.value,
      userId: userId.value,
      accessToken: session.value?.access_token ?? null,
    }),
  )
  const accessState = computed(() => syncAccess.value.accessState)

  return {
    session,
    user,
    userId,
    displayName: computed(() => getUserDisplayName(user.value)),
    isAuthenticated,
    isAuthReady: isReady,
    authError: supabaseAuthError,
    accessState,
    signInWithGithub,
    signOut,
  }
}
