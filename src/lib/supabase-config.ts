export type SupabaseEnvLike = {
  VITE_SUPABASE_URL?: string | undefined
  VITE_SUPABASE_ANON_KEY?: string | undefined
  VITE_SUPABASE_KEY?: string | undefined
}

export type ResolvedSupabaseEnv = {
  url: string | null
  anonKey: string | null
  isConfigured: boolean
}

export type ElectricUserScope = {
  where: string
  params: Record<string, string>
}

function normalizeEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

export function readSupabaseEnv(env: SupabaseEnvLike): ResolvedSupabaseEnv {
  const url = normalizeEnvValue(env.VITE_SUPABASE_URL)
  const anonKey = normalizeEnvValue(env.VITE_SUPABASE_ANON_KEY)

  return {
    url,
    anonKey,
    isConfigured: url !== null && anonKey !== null,
  }
}

export function getElectricUserScope(userId: string | null): ElectricUserScope {
  if (!userId) {
    return {
      where: '1 = 0',
      params: {},
    }
  }

  return {
    where: 'user_id = $1',
    params: {
      '1': userId,
    },
  }
}
