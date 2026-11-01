import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, assert, beforeAll, expect, test } from 'vite-plus/test'
import { safeParse } from 'valibot'

import { todoLabelSchema } from './collections'

const database = new PGlite()
const userId = '11111111-1111-4111-8111-111111111111'
const todoId = '22222222-2222-4222-8222-222222222222'
let mutationNumber = 0

beforeAll(async () => {
  // Isolated Postgres fixtures: no connection to the configured Supabase project.
  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.todos (
      id uuid primary key, label varchar(500) not null, week_number integer,
      done boolean not null, archived boolean not null, created_at bigint not null,
      updated_at bigint not null, device_id text, user_id uuid, deleted_at bigint
    );
    create table public.todo_mutation_ledger (
      mutation_id text primary key, user_id uuid not null, todo_id uuid not null,
      txid xid8 not null, accepted_at timestamptz not null default now()
    );
  `)
  for (const migration of ['0009_harden_todo_mutation_rpc', '0010_allow_shared_task_text']) {
    await database.exec(await readFile(new URL(`./out/${migration}.sql`, import.meta.url), 'utf8'))
  }
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId])
}, 30_000)

afterAll(async () => {
  await database.close()
})

function intent(label: string) {
  return {
    kind: 'create',
    mutationId: `shared-${++mutationNumber}`,
    todoId: crypto.randomUUID(),
    values: { label, weekNumber: null, done: false, archived: false, createdAt: 1, updatedAt: 1 },
  }
}

async function apply(value: ReturnType<typeof intent>) {
  return database.query('select public.apply_todo_mutation($1::jsonb)', [JSON.stringify(value)])
}

test('shared URLs and Unicode round-trip through client validation and the migrated RPC', async () => {
  const label = 'Grüße 👋\nRead https://example.com/a_b?q=hello%20world&lang=日本語#section'
  assert.equal(safeParse(todoLabelSchema, label).success, true)
  const mutation: ReturnType<typeof intent> = { ...intent(label), todoId }
  await apply(mutation)
  await apply(mutation)
  const { rows } = await database.query<{ label: string; user_id: string }>(
    'select label, user_id from public.todos where id = $1',
    [todoId],
  )
  assert.deepEqual(rows, [{ label, user_id: userId }])
})

test('client and RPC retain label length limits', async () => {
  for (const label of ['', 'a'.repeat(501)]) {
    assert.equal(safeParse(todoLabelSchema, label).success, false)
    await expect(apply(intent(label))).rejects.toThrow(/label|non-empty/i)
  }
  const label = 'a'.repeat(500)
  assert.equal(safeParse(todoLabelSchema, label).success, true)
  await apply(intent(label))
})

test('the replacement RPC preserves authentication, ownership, and timestamp checks', async () => {
  const invalidTimestamp = intent('Read https://example.com/')
  invalidTimestamp.values.updatedAt = -1
  await expect(apply(invalidTimestamp)).rejects.toThrow(/updatedAt must be epoch milliseconds/)

  await database.query("select set_config('request.jwt.claim.sub', '', false)")
  await expect(apply(intent('Signed out'))).rejects.toThrow(/requires an authenticated user/)
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [
    crypto.randomUUID(),
  ])
  await expect(
    database.query('select public.apply_todo_mutation($1::jsonb)', [
      JSON.stringify({
        kind: 'update',
        mutationId: 'cross-user',
        todoId,
        values: { label: 'Changed', updatedAt: 2 },
      }),
    ]),
  ).rejects.toThrow(/not found for the authenticated user/)
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId])
})

test('the replacement RPC remains executable only by authenticated clients', async () => {
  const { rows } = await database.query<{ anon: boolean; authenticated: boolean }>(`
    select has_function_privilege('anon', 'public.apply_todo_mutation(jsonb)', 'execute') as anon,
      has_function_privilege('authenticated', 'public.apply_todo_mutation(jsonb)', 'execute') as authenticated
  `)
  assert.deepEqual(rows, [{ anon: false, authenticated: true }])
})
