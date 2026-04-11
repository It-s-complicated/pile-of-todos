/// <reference types="node" />

import { readFile } from 'node:fs/promises'

import { assert, test } from 'vite-plus/test'

const rpcMigrationPath = new URL('../db/out/0004_todo_mutation_rpc.sql', import.meta.url)
const ledgerMigrationPath = new URL('../db/out/0005_todo_mutation_ledger.sql', import.meta.url)
const ledgerSnapshotPath = new URL('../db/out/meta/0005_snapshot.json', import.meta.url)
const journalPath = new URL('../db/out/meta/_journal.json', import.meta.url)

type LedgerSnapshot = {
  tables: {
    'public.todo_mutation_ledger': {
      columns: {
        accepted_at: {
          default: string
        }
      }
    }
  }
}

type DrizzleJournal = {
  entries: Array<{
    tag: string
  }>
}

const ledgerMigrationSqlPromise = readFile(ledgerMigrationPath, 'utf8')
const ledgerSnapshotPromise = readFile(ledgerSnapshotPath, 'utf8').then(
  (contents) => JSON.parse(contents) as LedgerSnapshot,
)
const journalPromise = readFile(journalPath, 'utf8').then(
  (contents) => JSON.parse(contents) as DrizzleJournal,
)

test('todo mutation RPC migration derives auth scope inside the database function', async () => {
  const migrationSql = await readFile(rpcMigrationPath, 'utf8')

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

test('todo mutation ledger migration persists accepted results for idempotent replay', async () => {
  const migrationSql = await ledgerMigrationSqlPromise

  assert.match(migrationSql, /create table public\.todo_mutation_ledger/i)
  assert.match(migrationSql, /"?mutation_id"? text not null/i)
  assert.match(migrationSql, /(primary key|unique\s*\("?mutation_id"?\))/i)
  assert.match(migrationSql, /"?user_id"? uuid not null/i)
  assert.match(migrationSql, /"?todo_id"? uuid not null/i)
  assert.match(migrationSql, /"?txid"? xid8 not null/i)
  assert.match(
    migrationSql,
    /select[\s\S]*from public\.todo_mutation_ledger[\s\S]*where mutation_id = requested_mutation_id[\s\S]*and user_id = acting_user_id/i,
  )
  assert.match(
    migrationSql,
    /return jsonb_build_object\([\s\S]*'mutationId', existing_mutation\.mutation_id[\s\S]*'todoId', existing_mutation\.todo_id[\s\S]*'txid', existing_mutation\.txid::text/i,
  )
  assert.match(migrationSql, /pg_current_xact_id\(\)/i)
  assert.match(
    migrationSql,
    /insert into public\.todo_mutation_ledger[\s\S]*requested_mutation_id[\s\S]*acting_user_id[\s\S]*requested_todo_id[\s\S]*accepted_txid/i,
  )
  assert.match(
    migrationSql,
    /return jsonb_build_object\([\s\S]*'mutationId', requested_mutation_id[\s\S]*'todoId', requested_todo_id[\s\S]*'txid', accepted_txid::text/i,
  )
})

test('todo mutation ledger migration uses a session-safe timestamptz default for accepted_at', async () => {
  const migrationSql = await ledgerMigrationSqlPromise
  const snapshotJson = await ledgerSnapshotPromise

  assert.match(migrationSql, /accepted_at timestamp with time zone not null default now\(\)/i)
  assert.notMatch(
    migrationSql,
    /accepted_at timestamp with time zone not null default timezone\('utc'::text, now\(\)\)/i,
  )
  assert.equal(
    snapshotJson.tables['public.todo_mutation_ledger'].columns.accepted_at.default,
    'now()',
  )
})

test('todo mutation ledger migration reserves accepted ledger writes for the mutation function', async () => {
  const migrationSql = await ledgerMigrationSqlPromise

  assert.notMatch(migrationSql, /create policy "todo_mutation_ledger_insert_own"/i)
  assert.notMatch(
    migrationSql,
    /grant\s+select\s*,\s*insert\s+on table public\.todo_mutation_ledger to authenticated/i,
  )
  assert.match(migrationSql, /grant select on table public\.todo_mutation_ledger to authenticated/i)
  assert.match(
    migrationSql,
    /create or replace function public\.apply_todo_mutation\(intent jsonb\)[\s\S]*security definer/i,
  )
})

test('todo mutation RPC migration is registered in the Drizzle journal', async () => {
  const journal = await journalPromise

  assert.equal(
    journal.entries.some(({ tag }) => tag === '0004_todo_mutation_rpc'),
    true,
  )
  assert.equal(
    journal.entries.some(({ tag }) => tag === '0005_todo_mutation_ledger'),
    true,
  )
})
