type RequiredEnvKey =
  | 'VITE_ELECTRIC_SHAPE_URL'
  | 'VITE_ELECTRIC_SOURCE_ID'
  | 'VITE_ELECTRIC_SECRET'
  | 'VITE_DEVICE_ID'
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_ANON_KEY'

function requireEnvValue(key: RequiredEnvKey): string {
  const value = import.meta.env[key]?.trim()

  if (value) {
    return value
  }

  throw new Error(`Missing required environment variable: ${key}`)
}

export const env = {
  electricShapeUrl: requireEnvValue('VITE_ELECTRIC_SHAPE_URL'),
  electricSourceId: requireEnvValue('VITE_ELECTRIC_SOURCE_ID'),
  electricSecret: requireEnvValue('VITE_ELECTRIC_SECRET'),
  deviceId: requireEnvValue('VITE_DEVICE_ID'),
  supabaseUrl: requireEnvValue('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnvValue('VITE_SUPABASE_ANON_KEY'),
} as const
