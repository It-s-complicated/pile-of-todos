import { computed, readonly, shallowRef } from 'vue'
import { createClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

import { env } from './env'

let cachedClient: SupabaseClient | null = null
let authBootstrapPromise: Promise<void> | null = null
let authSubscriptionInitialized = false
let authUrlChecked = false

const currentSession = shallowRef<Session | null>(null)
const authStateReady = shallowRef(false)
const authErrorMessage = shallowRef<string | null>(null)

function readAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  return (
    (
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error')
    )?.trim() || null
  )
}

function clearAuthErrorFromUrl() {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))

  ;['error', 'error_code', 'error_description'].forEach((key) => {
    url.searchParams.delete(key)
    hashParams.delete(key)
  })

  url.hash = hashParams.size > 0 ? `#${hashParams.toString()}` : ''
  window.history.replaceState({}, document.title, url.toString())
}

function ensureAuthUrlState() {
  if (authUrlChecked) {
    return
  }

  authUrlChecked = true

  const message = readAuthErrorFromUrl()
  if (!message) {
    return
  }

  authErrorMessage.value = message
  clearAuthErrorFromUrl()
}

function setSession(session: Session | null) {
  currentSession.value = session
  authStateReady.value = true

  if (session) {
    authErrorMessage.value = null
  }
}

async function ensureSupabaseAuthState() {
  ensureAuthUrlState()

  if (authBootstrapPromise) {
    await authBootstrapPromise
    return
  }

  const supabase = getSupabaseClient()

  authBootstrapPromise = (async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session ?? null)

    if (!authSubscriptionInitialized) {
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session ?? null)
      })
      authSubscriptionInitialized = true
    }
  })()

  await authBootstrapPromise
}

export function getSupabaseClient() {
  if (!cachedClient) {
    cachedClient = createClient(env.supabaseUrl, env.supabaseAnonKey)
  }

  return cachedClient
}

export function getApprovedGithubProviderId(): string {
  return env.approvedGithubProviderId
}

export async function getSupabaseSession(): Promise<Session | null> {
  await ensureSupabaseAuthState()
  return currentSession.value
}

export function setSupabaseAuthError(message: string | null) {
  authErrorMessage.value = message?.trim() || null
}

export async function signInWithGithub(): Promise<void> {
  ensureAuthUrlState()
  setSupabaseAuthError(null)

  const supabase = getSupabaseClient()

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: typeof window === 'undefined' ? undefined : window.location.href,
    },
  })

  if (error) {
    setSupabaseAuthError(error.message)
    throw new Error(error.message)
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    setSupabaseAuthError(error.message)
    throw new Error(error.message)
  }

  setSession(null)
}

export function useSupabaseAuthState() {
  void ensureSupabaseAuthState()

  return {
    isReady: readonly(authStateReady),
    session: readonly(currentSession),
    user: computed(() => currentSession.value?.user ?? null),
    userId: computed(() => currentSession.value?.user.id ?? null),
    authError: readonly(authErrorMessage),
  }
}
