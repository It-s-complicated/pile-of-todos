import { readFile } from 'node:fs/promises'

import { assert, test } from 'vite-plus/test'

const migrationPath = new URL('../db/out/0004_todo_mutation_rpc.sql', import.meta.url)
const journalPath = new URL('../db/out/meta/_journal.json', import.meta.url)

test('todo mutation RPC migration derives auth scope inside the database function', async () => {
  const migrationSql = await readFile(migrationPath, 'utf8')

  assert.match(
    migrationSql,
    /create or replace function public\.apply_todo_mutation\(intent jsonb\)/i,
  )
  assert.match(migrationSql, /acting_user_id uuid := auth\.uid\(\)/i)
  assert.notMatch(migrationSql, /intent->>'user_id'/i)
  assert.match(migrationSql, /insert into public\.todos[\s\S]*acting_user_id/i)
  assert.match(
    migrationSql,
    /update public\.todos[\s\S]*where id = requested_todo_id\s+and user_id = acting_user_id/i,
  )
  assert.match(migrationSql, /mutation_kind = 'create'/i)
  assert.match(migrationSql, /mutation_kind = 'update'/i)
  assert.match(migrationSql, /mutation_kind = 'delete'/i)
  assert.match(
    migrationSql,
    /grant execute on function public\.apply_todo_mutation\(jsonb\) to authenticated/i,
  )
})

test('todo mutation RPC migration is registered in the Drizzle journal', async () => {
  const journal = await readFile(journalPath, 'utf8')

  assert.match(journal, /0004_todo_mutation_rpc/)
})
