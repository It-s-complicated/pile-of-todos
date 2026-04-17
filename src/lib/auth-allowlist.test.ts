import { assert, test } from 'vite-plus/test'

import { getAuthAccessState, getAuthSyncAccess } from './auth-allowlist.ts'

test('getAuthAccessState treats the Supabase session as the only browser auth authority', () => {
  assert.equal(
    getAuthAccessState({
      isAuthenticated: true,
    }),
    'signed-in',
  )

  assert.equal(
    getAuthAccessState({
      isAuthenticated: false,
    }),
    'signed-out',
  )
})

test('getAuthSyncAccess strips synced credentials only when the browser is signed out', () => {
  assert.deepEqual(
    getAuthSyncAccess({
      isAuthenticated: false,
      userId: 'user-a',
      accessToken: 'token-a',
    }),
    {
      accessState: 'signed-out',
      userId: null,
      accessToken: null,
    },
  )

  assert.deepEqual(
    getAuthSyncAccess({
      isAuthenticated: true,
      userId: 'user-a',
      accessToken: 'token-a',
    }),
    {
      accessState: 'signed-in',
      userId: 'user-a',
      accessToken: 'token-a',
    },
  )
})
