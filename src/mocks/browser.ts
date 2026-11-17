import { network } from 'virtual:msw'

import { env } from '@/lib/env'

import { completeMockOAuthRedirect, MOCK_USER_ID } from './auth'
import { createMockDatabase } from './database'
import { createHandlers } from './handlers'

/**
 * Replaces Supabase (Auth, PostgREST, RPC, Realtime) with an in-browser mock,
 * so `vp run dev:mock` needs no network, account, or GitHub sign-in.
 * Resolves once requests are intercepted; never resolves while the page is
 * redirecting through the mock OAuth step.
 */
export async function startMockBackend(): Promise<void> {
  if (completeMockOAuthRedirect(env.supabaseUrl)) {
    return new Promise(() => {})
  }

  const database = createMockDatabase(window.localStorage, MOCK_USER_ID)

  network.configure({
    handlers: createHandlers(env.supabaseUrl, database),
    onUnhandledFrame({ frame, defaults }) {
      // Anything aimed at Supabase must be mocked; everything else (Vite, fonts) passes through.
      const request: unknown = 'request' in frame ? frame.request : null
      if (request instanceof Request && request.url.startsWith(env.supabaseUrl)) defaults.error()
    },
  })
  await network.enable()

  Object.assign(window, { mockBackend: { reset: () => (database.reset(), location.reload()) } })
  console.info('[mock] Supabase is mocked. Reset data with mockBackend.reset().')
}
