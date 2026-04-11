export type AuthIdentityLike = {
  provider?: string | null
  provider_id?: string | null
  identity_data?: {
    sub?: string | null
    [key: string]: unknown
  } | null
}

export type AuthAccessState = 'signed-out' | 'approved' | 'denied'

export type AuthAccessStateParams = {
  isAuthenticated: boolean
  githubProviderId: string | null
  approvedGithubProviderId: string
}

export type AuthSyncAccessParams = AuthAccessStateParams & {
  userId: string | null
  accessToken: string | null
}

export type AuthSyncAccess = {
  accessState: AuthAccessState
  userId: string | null
  accessToken: string | null
}

export function getGithubProviderId(
  identities: AuthIdentityLike[] | null | undefined,
): string | null {
  const githubIdentity = identities?.find((identity) => identity.provider === 'github')
  const providerId = githubIdentity?.provider_id ?? githubIdentity?.identity_data?.sub

  if (typeof providerId !== 'string') {
    return null
  }

  const trimmedProviderId = providerId.trim()
  return trimmedProviderId.length > 0 ? trimmedProviderId : null
}

export function getAuthAccessState({
  isAuthenticated,
  githubProviderId,
  approvedGithubProviderId,
}: AuthAccessStateParams): AuthAccessState {
  if (!isAuthenticated) {
    return 'signed-out'
  }

  const approvedProviderId = approvedGithubProviderId.trim()

  return githubProviderId === approvedProviderId ? 'approved' : 'denied'
}

export function getAuthSyncAccess(params: AuthSyncAccessParams): AuthSyncAccess {
  const accessState = getAuthAccessState(params)

  if (accessState !== 'approved') {
    return {
      accessState,
      userId: null,
      accessToken: null,
    }
  }

  return {
    accessState,
    userId: params.userId,
    accessToken: params.accessToken,
  }
}
