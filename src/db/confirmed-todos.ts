import type { ExternalParamsRecord } from '@electric-sql/client'
import { snakeCamelMapper } from '@electric-sql/client'
import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { createCollection } from '@tanstack/vue-db'

import { getAuthSyncAccess, getGithubProviderId } from '@/lib/auth-allowlist'
import { getApprovedGithubProviderId, getSupabaseSession } from '@/lib/supabase'
import { getElectricUserScope } from '@/lib/supabase-config'

import { todoSchema } from './collections'
import { getElectricReadShapeUrl } from './electric-read-config'
import { createElectricScopeParams } from './electric-user-scope'

type ConfirmedTodosResumeState =
  | {
      kind: 'reset'
      updatedAt: number
    }
  | {
      kind: 'resume'
      offset: string
      handle: string
      shapeId: string
      updatedAt: number
    }

function parseConfirmedTodosResumeState(value: unknown): ConfirmedTodosResumeState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  if (
    'kind' in value &&
    value.kind === 'reset' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  ) {
    return {
      kind: 'reset',
      updatedAt: value.updatedAt,
    }
  }

  if (
    'kind' in value &&
    value.kind === 'resume' &&
    'offset' in value &&
    typeof value.offset === 'string' &&
    'handle' in value &&
    typeof value.handle === 'string' &&
    'shapeId' in value &&
    typeof value.shapeId === 'string' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  ) {
    return {
      kind: 'resume',
      offset: value.offset,
      handle: value.handle,
      shapeId: value.shapeId,
      updatedAt: value.updatedAt,
    }
  }

  return null
}

function createConfirmedTodosCollection(shapeUrl: string) {
  const approvedGithubProviderId = getApprovedGithubProviderId()
  const readCurrentSyncAccess = async () => {
    const session = await getSupabaseSession()

    return getAuthSyncAccess({
      isAuthenticated: session !== null,
      githubProviderId: getGithubProviderId(session?.user.identities),
      approvedGithubProviderId,
      userId: session?.user.id ?? null,
      accessToken: session?.access_token ?? null,
    })
  }
  const currentUserScope = createElectricScopeParams(async () =>
    getElectricUserScope((await readCurrentSyncAccess()).userId),
  )

  return createCollection(
    electricCollectionOptions({
      id: 'confirmed-todos',
      schema: todoSchema,
      getKey: (item) => item.id,
      shapeOptions: {
        url: shapeUrl,
        headers: {
          Authorization: async () => {
            const { accessToken } = await readCurrentSyncAccess()
            return accessToken ? `Bearer ${accessToken}` : ''
          },
        },
        columnMapper: snakeCamelMapper(),
        parser: {
          int8: (value) => Number(value),
        },
        params: {
          table: 'todos',
          where: currentUserScope.where,
          params: currentUserScope.params,
        } as unknown as ExternalParamsRecord,
      },
    }),
  )
}

let cachedConfirmedTodosCollection: ReturnType<typeof createConfirmedTodosCollection> | null = null

export function getConfirmedTodosCollection() {
  if (cachedConfirmedTodosCollection) {
    return cachedConfirmedTodosCollection
  }

  cachedConfirmedTodosCollection = createConfirmedTodosCollection(getElectricReadShapeUrl())
  return cachedConfirmedTodosCollection
}

export function readConfirmedTodosResumeState(): ConfirmedTodosResumeState | null {
  return parseConfirmedTodosResumeState(
    getConfirmedTodosCollection()._state.syncedCollectionMetadata.get('electric:resume'),
  )
}

export function subscribeToConfirmedTodosTruncate(callback: () => void) {
  return getConfirmedTodosCollection().on('truncate', () => {
    callback()
  })
}
