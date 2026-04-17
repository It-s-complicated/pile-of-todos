export type AuthAccessState = 'signed-out' | 'signed-in'

type AuthAccessStateParams = {
  isAuthenticated: boolean
}

type AuthSyncAccessParams = AuthAccessStateParams & {
  accessToken: string | null
  userId: string | null
}

type AuthSyncAccess = {
  accessState: AuthAccessState
  accessToken: string | null
  userId: string | null
}

export function getAuthAccessState({ isAuthenticated }: AuthAccessStateParams): AuthAccessState {
  return isAuthenticated ? 'signed-in' : 'signed-out'
}

export function getAuthSyncAccess(params: AuthSyncAccessParams): AuthSyncAccess {
  const accessState = getAuthAccessState(params)

  if (accessState !== 'signed-in') {
    return {
      accessState,
      accessToken: null,
      userId: null,
    }
  }

  return {
    accessState,
    accessToken: params.accessToken,
    userId: params.userId,
  }
}
