import { assert, test } from 'vite-plus/test'

import { getAuthAccessState, getAuthSyncAccess, getGithubProviderId } from './auth-allowlist.ts'

test('getGithubProviderId returns the GitHub provider identity when present', () => {
  assert.equal(
    getGithubProviderId([
      {
        provider: 'email',
        identity_data: {
          sub: 'email-user-1',
        },
      },
      {
        provider: 'github',
        identity_data: {
          sub: 'github-user-42',
        },
      },
    ]),
    'github-user-42',
  )

  assert.equal(
    getGithubProviderId([
      {
        provider: 'github',
        provider_id: 'github-provider-id-7',
      },
    ]),
    'github-provider-id-7',
  )
})

test('getAuthAccessState maps authenticated users with the wrong GitHub identity to denied', () => {
  assert.equal(
    getAuthAccessState({
      isAuthenticated: true,
      githubProviderId: 'github-user-99',
      approvedGithubProviderId: 'github-user-42',
    }),
    'denied',
  )

  assert.equal(
    getAuthAccessState({
      isAuthenticated: true,
      githubProviderId: 'github-user-42',
      approvedGithubProviderId: 'github-user-42',
    }),
    'approved',
  )

  assert.equal(
    getAuthAccessState({
      isAuthenticated: false,
      githubProviderId: null,
      approvedGithubProviderId: 'github-user-42',
    }),
    'signed-out',
  )
})

test('getAuthSyncAccess strips synced credentials from denied authenticated users', () => {
  assert.deepEqual(
    getAuthSyncAccess({
      isAuthenticated: true,
      githubProviderId: 'github-user-99',
      approvedGithubProviderId: 'github-user-42',
      userId: 'user-denied',
      accessToken: 'token-denied',
    }),
    {
      accessState: 'denied',
      userId: null,
      accessToken: null,
    },
  )

  assert.deepEqual(
    getAuthSyncAccess({
      isAuthenticated: true,
      githubProviderId: 'github-user-42',
      approvedGithubProviderId: 'github-user-42',
      userId: 'user-approved',
      accessToken: 'token-approved',
    }),
    {
      accessState: 'approved',
      userId: 'user-approved',
      accessToken: 'token-approved',
    },
  )
})
