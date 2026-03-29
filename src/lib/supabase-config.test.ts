import { assert, test } from 'vite-plus/test'

import { getElectricUserScope, readSupabaseEnv } from './supabase-config.ts'

test('readSupabaseEnv requires the anon key and ignores the legacy fallback key', () => {
  assert.deepEqual(
    readSupabaseEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_KEY: 'legacy-key',
    }),
    {
      url: 'https://example.supabase.co',
      anonKey: null,
      isConfigured: false,
    },
  )
})

test('readSupabaseEnv returns configured state only when url and anon key are both present', () => {
  assert.deepEqual(
    readSupabaseEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    }),
    {
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
      isConfigured: true,
    },
  )
})

test('getElectricUserScope returns an empty shape for signed-out users', async () => {
  assert.deepEqual(await getElectricUserScope(null), {
    where: '1 = 0',
    params: {},
  })
})

test('getElectricUserScope filters Electric reads to the authenticated user', async () => {
  assert.deepEqual(await getElectricUserScope('user-123'), {
    where: 'user_id = $1',
    params: {
      '1': 'user-123',
    },
  })
})
