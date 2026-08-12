import * as v from 'valibot'

const requiredEnvValue = v.pipe(v.string(), v.trim(), v.nonEmpty())
const requiredEnvUrl = v.pipe(requiredEnvValue, v.url())

const appEnvSchema = v.object({
  VITE_DEVICE_ID: requiredEnvValue,
  VITE_SUPABASE_URL: requiredEnvUrl,
  VITE_SUPABASE_ANON_KEY: requiredEnvValue,
})

const parsedEnv = v.parse(appEnvSchema, import.meta.env)

export const env = {
  deviceId: parsedEnv.VITE_DEVICE_ID,
  supabaseUrl: parsedEnv.VITE_SUPABASE_URL,
  supabaseAnonKey: parsedEnv.VITE_SUPABASE_ANON_KEY,
} as const
