import { computed, readonly, shallowRef } from 'vue'
import { createClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from './supabase-config'

const supabaseEnv = readSupabaseEnv(import.meta.env)

let cachedClient: SupabaseClient | null = null
let authBootstrapPromise: Promise<void> | null = null
let authSubscriptionInitialized = false

const currentSession = shallowRef<Session | null>(null)
const authStateReady = shallowRef(false)

function setSession(session: Session | null) {
  currentSession.value = session
  authStateReady.value = true
}

async function ensureSupabaseAuthState() {
  if (authBootstrapPromise) {
    await authBootstrapPromise
    return
  }

  const supabase = getSupabaseClient()

  if (!supabase) {
    setSession(null)
    return
  }

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

export function isSupabaseConfigured(): boolean {
  return supabaseEnv.isConfigured
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseEnv.url!, supabaseEnv.anonKey!)
  }

  return cachedClient
}

export async function getSupabaseSession(): Promise<Session | null> {
  await ensureSupabaseAuthState()
  return currentSession.value
}

export async function getSupabaseUserId(): Promise<string | null> {
  return (await getSupabaseSession())?.user.id ?? null
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  return (await getSupabaseSession())?.access_token ?? null
}

export function useSupabaseAuthState() {
  void ensureSupabaseAuthState()

  return {
    isReady: readonly(authStateReady),
    session: readonly(currentSession),
    userId: computed(() => currentSession.value?.user.id ?? null),
  }
}
