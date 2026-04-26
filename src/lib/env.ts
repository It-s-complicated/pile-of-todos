import * as v from 'valibot'

const requiredEnvValue = v.pipe(v.string(), v.trim(), v.nonEmpty())
const requiredEnvUrl = v.pipe(requiredEnvValue, v.url())

const appEnvSchema = v.object({
  VITE_ELECTRIC_SHAPE_URL: requiredEnvUrl,
  VITE_ELECTRIC_SOURCE_ID: requiredEnvValue,
  VITE_ELECTRIC_SECRET: requiredEnvValue,
  VITE_DEVICE_ID: requiredEnvValue,
  VITE_SUPABASE_URL: requiredEnvUrl,
  VITE_SUPABASE_ANON_KEY: requiredEnvValue,
})

const parsedEnv = v.parse(appEnvSchema, import.meta.env)

export const env = {
  electricShapeUrl: parsedEnv.VITE_ELECTRIC_SHAPE_URL,
  electricSourceId: parsedEnv.VITE_ELECTRIC_SOURCE_ID,
  electricSecret: parsedEnv.VITE_ELECTRIC_SECRET,
  deviceId: parsedEnv.VITE_DEVICE_ID,
  supabaseUrl: parsedEnv.VITE_SUPABASE_URL,
  supabaseAnonKey: parsedEnv.VITE_SUPABASE_ANON_KEY,
} as const
