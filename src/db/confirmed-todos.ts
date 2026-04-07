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
