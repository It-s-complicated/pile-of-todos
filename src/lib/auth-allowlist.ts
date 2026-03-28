export type AuthIdentityLike = {
  provider?: string | null
  provider_id?: string | null
  identity_data?: {
    sub?: string | null
    [key: string]: unknown
  } | null
}

export type AuthAccessState = 'signed-out' | 'approved' | 'denied'

export type GuestClaimPromptState = {
  isAuthenticated: boolean
  guestTodoCount: number
  hasHandledClaimPrompt: boolean
}

export type AuthAccessStateParams = {
  isAuthenticated: boolean
  githubProviderId: string | null
  approvedGithubProviderId: string | null
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

export function isApprovedGithubIdentity(
  identity: AuthIdentityLike | null | undefined,
  approvedGithubProviderId: string | null | undefined,
): boolean {
  const providerId = getGithubProviderId(identity ? [identity] : [])
  const approvedProviderId = approvedGithubProviderId?.trim()

  return (
    identity?.provider === 'github' &&
    providerId !== null &&
    approvedProviderId !== undefined &&
    approvedProviderId !== null &&
    approvedProviderId.length > 0 &&
    providerId === approvedProviderId
  )
}

export function getAuthAccessState({
  isAuthenticated,
  githubProviderId,
  approvedGithubProviderId,
}: AuthAccessStateParams): AuthAccessState {
  if (!isAuthenticated) {
    return 'signed-out'
  }

  const approvedProviderId = approvedGithubProviderId?.trim()

  if (!approvedProviderId) {
    return 'approved'
  }

  return githubProviderId === approvedProviderId ? 'approved' : 'denied'
}

export function shouldShowGuestClaimPrompt({
  isAuthenticated,
  guestTodoCount,
  hasHandledClaimPrompt,
}: GuestClaimPromptState): boolean {
  return isAuthenticated && guestTodoCount > 0 && !hasHandledClaimPrompt
}
