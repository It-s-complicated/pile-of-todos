import type { User } from '@supabase/supabase-js'

/** The single local account used by the mock backend. */
export const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'

const TOKEN_LIFETIME_SECONDS = 60 * 60
const createdAt = '2026-01-14T00:00:00.000Z'

export const mockUser: User = {
  id: MOCK_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'you@pile-of-todos.local',
  app_metadata: { provider: 'github', providers: ['github'] },
  user_metadata: { user_name: 'you', name: 'Local You' },
  created_at: createdAt,
  updated_at: createdAt,
  identities: [],
}

function base64Url(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** An unsigned JWT: enough for clients that read the payload, never verified. */
function createAccessToken(expiresAt: number) {
  const header = base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      aud: 'authenticated',
      exp: expiresAt,
      iat: expiresAt - TOKEN_LIFETIME_SECONDS,
      role: 'authenticated',
      sub: MOCK_USER_ID,
      email: mockUser.email,
    }),
  )
  return `${header}.${payload}.mock-signature`
}

export function createSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS

  return {
    access_token: createAccessToken(expiresAt),
    refresh_token: `mock-refresh-${crypto.randomUUID()}`,
    expires_in: TOKEN_LIFETIME_SECONDS,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: mockUser,
  }
}

/** Reads the user id from a `Bearer` token; the anon key yields `null`. */
export function getUserIdFromRequest(request: Request): string | null {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const payload = token?.split('.')[1]

  if (!payload) {
    return null
  }

  try {
    const claims = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))) as {
      exp?: number
      sub?: string
    }
    const isExpired = claims.exp !== undefined && claims.exp * 1000 < Date.now()
    return isExpired ? null : (claims.sub ?? null)
  } catch {
    return null
  }
}

/**
 * Stands in for GitHub's consent screen. `signInWithOAuth` navigates the page
 * to `<supabase url>/auth/v1/authorize`; navigations bypass the service
 * worker, so the dev server's SPA fallback loads the app there and we finish
 * the implicit OAuth flow by redirecting back with a session in the hash.
 *
 * Returns `true` when the page is navigating away.
 */
export function completeMockOAuthRedirect(supabaseUrl: string): boolean {
  const authorizePath = `${new URL(supabaseUrl).pathname.replace(/\/$/, '')}/auth/v1/authorize`

  if (window.location.pathname !== authorizePath) {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  const redirectTo = new URL(params.get('redirect_to') ?? '/', window.location.origin)
  const session = createSession()

  redirectTo.hash = new URLSearchParams({
    access_token: session.access_token,
    expires_at: String(session.expires_at),
    expires_in: String(session.expires_in),
    provider_token: 'mock-github-token',
    refresh_token: session.refresh_token,
    token_type: session.token_type,
  }).toString()

  window.location.replace(redirectTo)
  return true
}
