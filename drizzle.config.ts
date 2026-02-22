import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit'

loadEnvFile(".env.local")
export default defineConfig({
  out: './src/db/out',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
