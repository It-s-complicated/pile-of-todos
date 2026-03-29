import { assert, test } from 'vite-plus/test'

import {
  getAuthAccessState,
  getGithubProviderId,
  isApprovedGithubIdentity,
  shouldShowGuestClaimPrompt,
} from './auth-allowlist.ts'

test('isApprovedGithubIdentity detects the approved GitHub provider_id', () => {
  assert.equal(
    isApprovedGithubIdentity(
      {
        provider: 'github',
        identity_data: {
          sub: 'github-user-42',
        },
      },
      'github-user-42',
    ),
    true,
  )

  assert.equal(
    isApprovedGithubIdentity(
      {
        provider: 'github',
        identity_data: {
          sub: 'github-user-99',
        },
      },
      'github-user-42',
    ),
    false,
  )
})

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

test('shouldShowGuestClaimPrompt only shows once for authenticated users with guest todos', () => {
  assert.equal(
    shouldShowGuestClaimPrompt({
      isAuthenticated: true,
      guestTodoCount: 2,
      hasHandledClaimPrompt: false,
    }),
    true,
  )

  assert.equal(
    shouldShowGuestClaimPrompt({
      isAuthenticated: true,
      guestTodoCount: 0,
      hasHandledClaimPrompt: false,
    }),
    false,
  )

  assert.equal(
    shouldShowGuestClaimPrompt({
      isAuthenticated: false,
      guestTodoCount: 2,
      hasHandledClaimPrompt: false,
    }),
    false,
  )

  assert.equal(
    shouldShowGuestClaimPrompt({
      isAuthenticated: true,
      guestTodoCount: 2,
      hasHandledClaimPrompt: true,
    }),
    false,
  )
})
