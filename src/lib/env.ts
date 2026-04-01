type RequiredEnvKey =
  | 'VITE_ELECTRIC_SHAPE_URL'
  | 'VITE_DEVICE_ID'
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_ANON_KEY'
  | 'VITE_APPROVED_GITHUB_PROVIDER_ID'

function requireEnvValue(key: RequiredEnvKey): string {
  const value = import.meta.env[key]?.trim()

  if (value) {
    return value
  }

  throw new Error(`Missing required environment variable: ${key}`)
}

export const env = {
  electricShapeUrl: requireEnvValue('VITE_ELECTRIC_SHAPE_URL'),
  deviceId: requireEnvValue('VITE_DEVICE_ID'),
  supabaseUrl: requireEnvValue('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnvValue('VITE_SUPABASE_ANON_KEY'),
  approvedGithubProviderId: requireEnvValue('VITE_APPROVED_GITHUB_PROVIDER_ID'),
} as const
