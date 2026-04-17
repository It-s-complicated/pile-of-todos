import { loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'

loadEnvFile('.env.local')

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

export default defineConfig({
  out: './src/db/out',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
