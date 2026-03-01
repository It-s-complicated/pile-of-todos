# Cloud Sync Implementation Plan

**Status**: Completed - Option A: Electric Cloud (reads) + Supabase SDK (writes)
**Last Updated**: 2026-02-24
**Decision**: Electric Cloud for real-time reads + Supabase SDK for writes (no Edge Functions needed)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROJECT STRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   Drizzle ORM    │     │   Drizzle Kit    │     │  Migration SQL   │    │
│  │   (Schema)       │────►│   (CLI Tool)     │────►│  (src/db/out/)   │    │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘    │
│           │                                              │                  │
│           │ npm run migrate:generate                     │ npm run migrate  │
│           ▼                                              ▼                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE POSTGRESQL                               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  TABLE: todos (created via Drizzle migrations)              │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │                                        │
│  ┌─────────────────────────────────┴────────────────────────────────────┐   │
│  │                         ELECTRIC CLOUD                              │   │
│  │  - Real-time sync from Postgres to clients (READS)                 │   │
│  │  - Shape subscriptions via VITE_ELECTRIC_SHAPE_URL                │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │ Real-time read sync                    │
│  ┌─────────────────────────────────┴────────────────────────────────────┐   │
│  │                    CLIENT (Vue 3 SPA)                               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  TanStack DB + electricCollectionOptions                    │  │   │
│  │  │  - READS: Electric Cloud shape stream                       │  │   │
│  │  │  - WRITES: Supabase SDK (direct to Postgres)                │  │   │
│  │  │  - txid: Date.now() as pseudo-txid                         │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start Checklist

- [x] Install Drizzle dependencies: `npm install drizzle-orm drizzle-valibot pg` + dev deps
- [x] Create `drizzle.config.ts` with your `DATABASE_URL`
- [x] Create `src/db/schema.ts` with todos table definition
- [x] Create `src/db/connection.ts` for PostgreSQL pool
- [x] Add migration scripts to `package.json`
- [x] Run `npm run migrate:generate` to create initial migration
- [x] Run `npm run migrate` to apply to Supabase database
- [x] Verify Electric Cloud source is connected to your database
- [x] Update `.env.local` with all required variables
- [x] Install Supabase SDK: `npm install @supabase/supabase-js`
- [x] Create `src/lib/supabase.ts` client
- [x] Update `src/db/collections.ts` with Supabase SDK for writes
- [ ] Test: Add a todo and verify it syncs to Supabase

## Overview

This document outlines the implementation plan for adding cloud synchronization to the AI Todo App using ElectricSQL Cloud (reads) and Supabase SDK (writes).

### Final Architecture: Electric Cloud + Supabase SDK

**Key Points:**

1. **Electric Cloud for READS** - Real-time sync from Postgres to client via shape stream
2. **Supabase SDK for WRITES** - Direct writes to Postgres (no Edge Functions needed)
3. **Pseudo-txid** - Using `Date.now()` as txid (TanStack DB can work without real Postgres txid)
4. **No backend server required** - Frontend connects directly to both services

**Architecture Overview:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROJECT STRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   Drizzle ORM    │     │   Drizzle Kit    │     │  Migration SQL   │    │
│  │   (Schema)       │────►│   (CLI Tool)     │────►│  (src/db/out/)   │    │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘    │
│           │                                              │                  │
│           │ npm run migrate:generate                     │ npm run migrate  │
│           ▼                                              ▼                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE POSTGRESQL                               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  TABLE: todos (created via Drizzle migrations)               │  │   │
│  │  │  - id: uuid PRIMARY KEY                                      │  │   │
│  │  │  - label: varchar(500)                                       │  │   │
│  │  │  - week_number: integer (nullable)                           │  │   │
│  │  │  - done: boolean DEFAULT false                               │  │   │
│  │  │  - archived: boolean DEFAULT false                           │  │   │
│  │  │  - created_at: bigint                                        │  │   │
│  │  │  - updated_at: bigint                                        │  │   │
│  │  │  - device_id: varchar(255) (nullable)                        │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │ Postgres Replication                    │
│  ┌─────────────────────────────────┴────────────────────────────────────┐   │
│  │                         ELECTRIC CLOUD                               │   │
│  │  - Syncs changes from Postgres to clients via WebSocket              │   │
│  │  - Handles shape subscriptions (real-time queries)                   │   │
│  │  - Requires SOURCE_ID and SECRET for authentication                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │ WebSocket Sync                          │
│  ┌─────────────────────────────────┴────────────────────────────────────┐   │
│  │                         CLIENT (Vue 3 SPA)                           │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │  Direct Electric Cloud Connection (No backend server)          │  │   │
│  │  │  - Reads: Subscribe to shapes via VITE_ELECTRIC_SHAPE_URL      │  │   │
│  │  │  - Writes: HTTP requests to Electric proxy endpoint            │  │   │
│  │  │  - Returns txid for optimistic update confirmation             │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Differences from Option A (Full Backend):**

1. **No backend server** - Frontend connects directly to Electric Cloud
2. **Drizzle ORM only for migrations** - Not used for runtime queries
3. **Migration capability** - Can generate and run migrations against the database
4. **Simpler architecture** - Good for prototypes and single-user apps
5. **Trade-offs**: Less secure (credentials in frontend), limited auth options

**Environment Variables:**

```bash
# Database (for migrations only - not used by frontend)
DATABASE_URL=postgresql://postgres.wbsgscgtlbakvuwtitof:KFamqQYz2ykOE9Kf@aws-1-eu-west-1.pooler.supabase.com:5432/postgres

# Electric Cloud (used by frontend)
VITE_ELECTRIC_SHAPE_URL=https://svc-yappy-alpaca-ankg6kcezx.electric-sql.cloud/v1/shape
VITE_API_BASE_URL=https://svc-yappy-alpaca-ankg6kcezx.electric-sql.cloud
VITE_ELECTRIC_SOURCE_ID=svc-yappy-alpaca-ankg6kcezx
VITE_ELECTRIC_SECRET=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Device identification
VITE_DEVICE_ID=desktop-chrome-001
```

## Environment Variables

```bash
# Database (for migrations only - not used by frontend)
DATABASE_URL=postgresql://postgres.wbsgscgtlbakvuwtitof:KFamqQYz2ykOE9Kf@aws-1-eu-west-1.pooler.supabase.com:5432/postgres

# Electric Cloud (used by frontend for READS)
VITE_ELECTRIC_SHAPE_URL=https://api.electric-sql.cloud/v1/shape
VITE_ELECTRIC_SOURCE_ID=svc-rude-peacock-bxymgk1c1m
VITE_ELECTRIC_SECRET=eyJ0eXAiOiJKV1Qi...

# Supabase (used by frontend for WRITES)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-publishable-key

# Device identification
VITE_DEVICE_ID=desktop-chrome-001
```

## Implementation

### Step 1: Dependencies

```bash
# Already installed
npm install @tanstack/vue-db @tanstack/electric-db-collection @electric-sql/client
npm install drizzle-orm drizzle-valibot pg

# For writes - NEW
npm install @supabase/supabase-js
```

### Step 2: Supabase Client

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
```

### Step 3: Collections Configuration

Update `src/db/collections.ts`:

```typescript
import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { supabase } from '@/lib/supabase'

export const electricTodosCollection = createCollection(
  electricCollectionOptions({
    id: 'electric-todos',
    schema: todoSchema,
    getKey: (item) => item.id,
    shapeOptions: {
      url: prepareElectricShapeUrl().toString(),
      params: { table: 'todos' },
    },
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]
      const { error } = await supabase.from('todos').insert({
        id: newTodo.id,
        label: newTodo.label,
        week_number: newTodo.weekNumber,
        done: newTodo.done,
        archived: newTodo.archived,
        created_at: newTodo.createdAt,
        updated_at: newTodo.updatedAt,
        device_id: newTodo.deviceId,
      })
      if (error) throw new Error(error.message)
      return { txid: Date.now() }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedTodo } = transaction.mutations[0]
      const { error } = await supabase
        .from('todos')
        .update({
          label: updatedTodo.label,
          week_number: updatedTodo.weekNumber,
          done: updatedTodo.done,
          archived: updatedTodo.archived,
          updated_at: updatedTodo.updatedAt,
          device_id: updatedTodo.deviceId,
        })
        .eq('id', updatedTodo.id)
      if (error) throw new Error(error.message)
      return { txid: Date.now() }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTodo } = transaction.mutations[0]
      const { error } = await supabase.from('todos').delete().eq('id', deletedTodo.id)
      if (error) throw new Error(error.message)
      return { txid: Date.now() }
    },
  }),
)
```

## Key Design Decisions

### 1. No Real txid Required

TanStack DB supports using any comparable value as txid. Using `Date.now()` works because:

- Electric Cloud syncs changes in real-time (sub-second)
- The pseudo-txid is used to wait for the change to appear in the stream
- Works well for typical use cases

### 2. Supabase SDK for Writes

Direct Supabase SDK usage (no Edge Functions) because:

- Simpler setup - no Deno/Edge Functions needed
- Supabase handles authentication via anon key
- Works with RLS policies
- Returns immediately after write completes

## Implementation Phases

### Phase 1: Dependencies & Configuration (COMPLETED)

#### 1.1 Install Dependencies (COMPLETED)

```bash
# Core Electric/TanStack dependencies
npm install @tanstack/electric-db-collection @tanstack/vue-db

# Drizzle ORM for database schema and migrations
npm install drizzle-orm drizzle-valibot pg
npm install -D drizzle-kit @types/pg

# Supabase SDK for writes (NEW)
npm install @supabase/supabase-js
```

#### 1.2 Environment Variables

Update `.env.local`:

```bash
# Database (for migrations only - NOT exposed to frontend)
DATABASE_URL=postgresql://postgres.wbsgscgtlbakvuwtitof:KFamqQYz2ykOE9Kf@aws-1-eu-west-1.pooler.supabase.com:5432/postgres

# Electric Cloud (used by frontend for READS)
VITE_ELECTRIC_SHAPE_URL=https://api.electric-sql.cloud/v1/shape
VITE_ELECTRIC_SOURCE_ID=svc-rude-peacock-bxymgk1c1m
VITE_ELECTRIC_SECRET=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Supabase (used by frontend for WRITES) - NEW
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-publishable-key

# Device identification
VITE_DEVICE_ID=desktop-chrome-001
```

#### 1.3 Create Drizzle Configuration

Create `drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './src/db/out',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

#### 1.4 Create Database Schema

Create `src/db/schema.ts`:

```typescript
import { pgTable, uuid, varchar, integer, boolean, bigint } from 'drizzle-orm/pg-core'
import { createSelectSchema, createInsertSchema } from 'drizzle-valibot'
import { valibot } from 'valibot'

// Define the todos table matching your current TodoSchema
export const todosTable = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: varchar('label', { length: 500 }).notNull(),
  weekNumber: integer('week_number'),
  done: boolean('done').default(false).notNull(),
  archived: boolean('archived').default(false).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  deviceId: varchar('device_id', { length: 255 }),
})

// Generate valibot schemas from Drizzle schema
export const selectTodoSchema = createSelectSchema(todosTable)
export const insertTodoSchema = createInsertSchema(todosTable)

// Export types
export type Todo = valibot.InferOutput<typeof selectTodoSchema>
export type NewTodo = valibot.InferOutput<typeof insertTodoSchema>
```

#### 1.5 Create Database Connection (for migrations)

Create `src/db/connection.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({ connectionString: databaseUrl })
export const db = drizzle({ client: pool, casing: 'snake_case' })
```

#### 1.6 Add Migration Scripts

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "migrate": "drizzle-kit migrate",
    "migrate:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix"
  }
}
```

#### 1.7 Generate and Run Initial Migration

```bash
# Generate migration SQL from schema
npm run migrate:generate

# This creates: src/db/out/0000_initial_schema.sql

# Apply migration to database
npm run migrate
```

**Generated Migration SQL** (in `src/db/out/0000_initial_schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(500) NOT NULL,
	"week_number" integer,
	"done" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"device_id" varchar(255)
);

-- Optional: Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_todos_week_number" ON "todos" ("week_number");
CREATE INDEX IF NOT EXISTS "idx_todos_done" ON "todos" ("done");
CREATE INDEX IF NOT EXISTS "idx_todos_archived" ON "todos" ("archived");
```

#### 1.8 Verify Database Setup

Connect to your database and verify:

```bash
# Using the psql command with your DATABASE_URL
psql "postgresql://postgres.wbsgscgtlbakvuwtitof:KFamqQYz2ykOE9Kf@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" \
  -c "\dt" -c "SELECT * FROM todos LIMIT 1;"
```

Or check via Supabase Dashboard:

1. Go to your Supabase project
2. Navigate to "Database" → "Tables"
3. Verify the `todos` table exists with correct columns

```sql
-- Create todos table with Electric sync support
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  week_number INTEGER,
  done BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT  -- For tracking which device created/last modified
);

-- Indexes for performance
CREATE INDEX idx_todos_week_number ON todos(week_number);
CREATE INDEX idx_todos_done ON todos(done);
CREATE INDEX idx_todos_archived ON todos(archived);
CREATE INDEX idx_todos_device_id ON todos(device_id);

-- Enable Row Level Security (for future multi-user support)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
```

### Phase 2: Create Supabase Client (COMPLETED)

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase configuration')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
```

### Phase 3: Update Collections with Supabase Writes (COMPLETED)

Update `src/db/collections.ts` to use Supabase SDK instead of fetch:

```typescript
import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { supabase } from '@/lib/supabase'

export const electricTodosCollection = createCollection(
  electricCollectionOptions({
    id: 'electric-todos',
    schema: todoSchema,
    getKey: (item) => item.id,
    shapeOptions: {
      url: prepareElectricShapeUrl().toString(),
      params: { table: 'todos' },
    },
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]

      const { error } = await supabase.from('todos').insert({
        id: newTodo.id,
        label: newTodo.label,
        week_number: newTodo.weekNumber,
        done: newTodo.done,
        archived: newTodo.archived,
        created_at: newTodo.createdAt,
        updated_at: newTodo.updatedAt,
        device_id: newTodo.deviceId,
      })

      if (error) throw new Error(error.message)
      return { txid: Date.now() }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedTodo } = transaction.mutations[0]

      const { error } = await supabase
        .from('todos')
        .update({
          label: updatedTodo.label,
          week_number: updatedTodo.weekNumber,
          done: updatedTodo.done,
          archived: updatedTodo.archived,
          updated_at: updatedTodo.updatedAt,
          device_id: updatedTodo.deviceId,
        })
        .eq('id', updatedTodo.id)

      if (error) throw new Error(error.message)
      return { txid: Date.now() }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTodo } = transaction.mutations[0]

      const { error } = await supabase.from('todos').delete().eq('id', deletedTodo.id)

      if (error) throw new Error(error.message)
      return { txid: Date.now() }
    },
  }),
)
```

3. Return txid from the transaction

Example proxy implementation (if self-hosting proxy):

```typescript
// proxy/todos.ts
import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client'

const ELECTRIC_BASE_URL = 'https://<your-instance>.electric-sql.cloud/v1/shape'

export async function handleTodosRequest(request: Request) {
  const url = new URL(request.url)
  const method = request.method

  // Check authentication here
  // const user = await authenticate(request)

  // Handle write operations
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return handleWrite(request, method)
  }

  // For read operations, proxy to Electric
  return proxyToElectric(url)
}

async function handleWrite(request: Request, method: string) {
  // Connect to your Postgres database
  const db = createDatabaseConnection()

  let txid: number
  let result: any

  // CRITICAL: txid must be queried INSIDE the same transaction
  await db.transaction(async (trx) => {
    // Query txid FIRST, inside the transaction
    const txidResult = await trx.execute(`SELECT pg_current_xact_id()::xid::text as txid`)
    txid = parseInt(txidResult.rows[0].txid, 10)

    // Perform the mutation inside the same transaction
    switch (method) {
      case 'POST':
        const newTodo = await request.json()
        result = await trx.insert('todos', newTodo).returning('*')
        break

      case 'PUT':
        const url = new URL(request.url)
        const id = url.pathname.split('/').pop()
        const updates = await request.json()
        result = await trx('todos')
          .where({ id })
          .update({ ...updates, updated_at: new Date().toISOString() })
          .returning('*')
        break

      case 'DELETE':
        const deleteUrl = new URL(request.url)
        const deleteId = deleteUrl.pathname.split('/').pop()
        result = await trx('todos').where({ id: deleteId }).del()
        break
    }
  })

  // Return the txid from the transaction where mutation occurred
  return new Response(JSON.stringify({ success: true, data: result, txid }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

#### Option B: Supabase Edge Functions

If using Supabase, create an edge function that:

1. Runs mutations in a transaction
2. Queries `pg_current_xact_id()::xid::text` inside that transaction
3. Returns the txid

```typescript
// supabase/functions/todos/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const url = new URL(req.url)
  const method = req.method

  try {
    let result: any
    let txid: number | null = null

    // Execute everything in a single transaction using RPC
    const { data: txData, error: txError } = await supabase.rpc('execute_todo_operation', {
      p_method: method,
      p_path: url.pathname,
      p_body: method !== 'DELETE' ? await req.json() : null,
    })

    if (txError) throw txError

    result = txData.result
    txid = txData.txid

    return new Response(JSON.stringify({ success: true, data: result, txid }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

Supabase SQL function:

```sql
-- Supabase database function
CREATE OR REPLACE FUNCTION execute_todo_operation(
  p_method TEXT,
  p_path TEXT,
  p_body JSONB DEFAULT NULL
)
RETURNS TABLE(result JSONB, txid BIGINT) AS $$
DECLARE
  v_id UUID;
  v_todo JSONB;
  v_txid BIGINT;
BEGIN
  -- Get txid FIRST, before any mutations
  SELECT pg_current_xact_id()::xid::text::bigint INTO v_txid;

  -- Extract ID from path
  v_id := split_part(p_path, '/', 3)::UUID;

  CASE p_method
    WHEN 'POST' THEN
      INSERT INTO todos (
        id, label, week_number, done, archived,
        created_at, updated_at, device_id
      ) VALUES (
        COALESCE((p_body->>'id')::UUID, gen_random_uuid()),
        p_body->>'label',
        (p_body->>'weekNumber')::INTEGER,
        COALESCE((p_body->>'done')::BOOLEAN, false),
        COALESCE((p_body->>'archived')::BOOLEAN, false),
        COALESCE((p_body->>'createdAt')::BIGINT, extract(epoch from now()) * 1000),
        COALESCE((p_body->>'updatedAt')::BIGINT, extract(epoch from now()) * 1000),
        p_body->>'deviceId'
      )
      RETURNING to_jsonb(todos.*) INTO v_todo;

    WHEN 'PUT' THEN
      UPDATE todos
      SET
        label = COALESCE(p_body->>'label', label),
        week_number = COALESCE((p_body->>'weekNumber')::INTEGER, week_number),
        done = COALESCE((p_body->>'done')::BOOLEAN, done),
        archived = COALESCE((p_body->>'archived')::BOOLEAN, archived),
        updated_at = extract(epoch from now()) * 1000,
        device_id = COALESCE(p_body->>'deviceId', device_id)
      WHERE id = v_id
      RETURNING to_jsonb(todos.*) INTO v_todo;

    WHEN 'DELETE' THEN
      DELETE FROM todos WHERE id = v_id
      RETURNING to_jsonb(todos.*) INTO v_todo;
  END CASE;

  RETURN QUERY SELECT v_todo, v_txid;
END;
$$ LANGUAGE plpgsql;
```

**Note**: Phase 3 (Backend API) is NOT NEEDED with the new approach. We use Supabase SDK directly for writes.

#### 4.1 Create useElectricTodos.ts

```typescript
// src/composables/useElectricTodos.ts
import { computed, ref } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'
import { electricTodosCollection, localTodosCollection, type Todo } from '@/db/collections'
import { useNetworkStatus } from './useNetworkStatus'

export function useElectricTodos() {
  const { isOnline } = useNetworkStatus()
  const isMigrating = ref(false)
  const syncStatus = ref<'synced' | 'syncing' | 'error'>('synced')

  // Use electric collection when online, local when offline
  const activeCollection = computed(() =>
    isOnline.value ? electricTodosCollection : localTodosCollection,
  )

  // Live query from active collection
  const { data: todos } = useLiveQuery((q) => q.from({ todo: activeCollection.value }))

  // Migration: Upload local todos to cloud
  async function migrateLocalTodos() {
    if (!isOnline.value) return

    isMigrating.value = true
    syncStatus.value = 'syncing'

    try {
      const localTodos = localTodosCollection.utils.getAll()

      for (const todo of localTodos) {
        // Add device_id
        const todoWithDevice = {
          ...todo,
          deviceId: import.meta.env.VITE_DEVICE_ID,
        }

        // Insert via API (will trigger Electric sync)
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/todos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(todoWithDevice),
        })

        if (!response.ok) {
          throw new Error(`Failed to migrate todo ${todo.id}`)
        }
      }

      // Clear local storage after successful migration
      localTodosCollection.utils.clear()
      syncStatus.value = 'synced'
    } catch (error) {
      console.error('Migration failed:', error)
      syncStatus.value = 'error'
    } finally {
      isMigrating.value = false
    }
  }

  function addTodo(label: string, weekNumber: number | null): string {
    const id = crypto.randomUUID()
    const now = Date.now()

    const todo: Todo = {
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deviceId: import.meta.env.VITE_DEVICE_ID,
    }

    // Insert into active collection
    // If online: triggers onInsert handler → API call → waits for txid
    // If offline: stores locally, syncs when reconnected
    activeCollection.value.insert(todo)

    return id
  }

  function updateTodo(id: string, updates: Partial<Todo>): void {
    activeCollection.value.update(id, (draft) => {
      Object.assign(draft, updates, {
        updatedAt: Date.now(),
        deviceId: import.meta.env.VITE_DEVICE_ID,
      })
    })
  }

  function deleteTodo(id: string): void {
    activeCollection.value.delete(id)
  }

  function toggleTodoDone(id: string): void {
    const todo = todos.value?.find((t) => t.id === id)
    if (todo) {
      updateTodo(id, { done: !todo.done })
    }
  }

  function archiveTodo(id: string): void {
    updateTodo(id, { archived: true })
  }

  return {
    todos: computed(() => todos.value ?? []),
    isOnline,
    isMigrating,
    syncStatus,
    migrateLocalTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodoDone,
    archiveTodo,
  }
}
```

#### 4.2 Update useNetworkStatus.ts

```typescript
// src/composables/useNetworkStatus.ts
import { onMounted, onUnmounted, ref } from 'vue'

export function useNetworkStatus() {
  const isOnline = ref(navigator.onLine)

  function handleOnline() {
    isOnline.value = true
  }

  function handleOffline() {
    isOnline.value = false
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { isOnline }
}
```

### Phase 5: UI Components Update (2-3 hours)

#### 5.1 Add Sync Status Indicator

Create `src/components/SyncStatus.vue`:

```vue
<template>
  <div class="flex items-center gap-2 text-sm">
    <div
      class="w-2 h-2 rounded-full"
      :class="{
        'bg-green-500': isOnline && syncStatus === 'synced',
        'bg-yellow-500': syncStatus === 'syncing' || isMigrating,
        'bg-red-500': !isOnline || syncStatus === 'error',
      }"
    />
    <span class="text-gray-600">
      {{ statusText }}
    </span>
    <button
      v-if="localTodosCount > 0 && isOnline"
      @click="migrateLocalTodos"
      class="text-blue-500 hover:text-blue-700 text-xs"
      :disabled="isMigrating"
    >
      {{ isMigrating ? 'Migrating...' : `Upload ${localTodosCount} local` }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useElectricTodos } from '@/composables/useElectricTodos'
import { localTodosCollection } from '@/db/collections'

const { isOnline, isMigrating, syncStatus, migrateLocalTodos } = useElectricTodos()

const localTodosCount = computed(() => {
  return localTodosCollection.utils.getAll().length
})

const statusText = computed(() => {
  if (!isOnline.value) return 'Offline'
  if (isMigrating.value) return 'Migrating...'
  if (syncStatus.value === 'syncing') return 'Syncing...'
  if (syncStatus.value === 'error') return 'Sync error'
  return 'Synced'
})
</script>
```

#### 5.2 Update App.vue

Add sync status indicator:

```vue
<template>
  <div class="app">
    <header class="flex justify-between items-center p-4">
      <h1>AI Todo App</h1>
      <SyncStatus />
    </header>
    <!-- ... rest of app -->
  </div>
</template>

<script setup lang="ts">
import SyncStatus from '@/components/SyncStatus.vue'
</script>
```

### Phase 6: Migration from LocalStorage (1-2 hours)

Create `src/composables/useMigration.ts`:

```typescript
import { onMounted, ref } from 'vue'
import { localTodosCollection } from '@/db/collections'
import { useElectricTodos } from './useElectricTodos'

export function useMigration() {
  const hasMigrated = ref(false)
  const hasPrompted = ref(false)
  const { isOnline, migrateLocalTodos } = useElectricTodos()

  onMounted(async () => {
    // Check if there's local data to migrate
    const localTodos = localTodosCollection.utils.getAll()

    if (localTodos.length > 0 && isOnline.value && !hasPrompted.value) {
      hasPrompted.value = true

      // Ask user for migration
      const shouldMigrate = confirm(`Found ${localTodos.length} local todos. Upload to cloud?`)

      if (shouldMigrate) {
        await migrateLocalTodos()
        hasMigrated.value = true
      }
    }
  })

  return { hasMigrated }
}
```

Use it in App.vue:

```vue
<script setup lang="ts">
import { useMigration } from '@/composables/useMigration'

// Initialize migration check
useMigration()
</script>
```

### Phase 7: Schema Evolution with Drizzle (Ongoing)

When you need to modify the database schema:

#### 7.1 Making Schema Changes

1. **Edit `src/db/schema.ts`**:

   ```typescript
   // Example: Adding a new column
   export const todosTable = pgTable('todos', {
     // ... existing columns
     priority: integer('priority').default(0), // New column
   })
   ```

2. **Update frontend TodoSchema** (if needed):

   ```typescript
   export const TodoSchema = object({
     // ... existing fields
     priority: nullable(number()), // Add to valibot schema
   })
   ```

3. **Generate migration**:

   ```bash
   npm run migrate:generate
   ```

4. **Review generated SQL** in `src/db/out/0001_add_priority.sql`:

   ```sql
   ALTER TABLE "todos" ADD COLUMN "priority" integer DEFAULT 0;
   ```

5. **Apply migration**:
   ```bash
   npm run migrate
   ```

#### 7.2 Migration Best Practices

- **Always review generated SQL** before applying
- **Test migrations on a copy** of production data first
- **Make additive changes** (add columns) rather than destructive ones
- **Use DEFAULT values** for new NOT NULL columns
- **Version control** your migration files in `src/db/out/`

#### 7.3 Troubleshooting Migrations

**Error: "column already exists"**

- Migration was already applied but Drizzle lost track
- Fix: Mark as applied manually or reset migrations

**Error: "syntax error" in generated SQL**

- Drizzle Kit may generate incorrect SQL for complex changes
- Fix: Edit the SQL file manually before applying

**View migration status**:

```bash
# Check which migrations have been applied
npx drizzle-kit check
```

### Phase 8: Testing & Debugging (2-3 hours)

#### 7.1 Testing Checklist

- [ ] Add todo → appears immediately → syncs to cloud → appears on other device
- [ ] Edit todo on device A → updates on device B in real-time
- [ ] Go offline → add todo → go online → todo syncs to cloud
- [ ] Migration: LocalStorage todos upload to cloud correctly
- [ ] Concurrent edits: Last write wins (Postgres txid ordering)
- [ ] Large todo list performance (>100 todos)
- [ ] Error handling: Failed API calls roll back optimistic updates

#### 7.2 Debugging Txid Issues

Enable debug logging in browser console:

```javascript
localStorage.debug = 'ts/db:electric'
```

**Common Issue: awaitTxId Stalls or Times Out**

This happens when the txid returned from your API doesn't match the actual transaction ID of the mutation. This occurs when you query `pg_current_xact_id()` **outside** the same transaction that performs the mutation.

**When txids DON'T match (bug):**

```
ts/db:electric awaitTxId called with txid 124
ts/db:electric new txids synced from pg [123]
// Stalls forever - 124 never arrives!
```

**When txids DO match (correct):**

```
ts/db:electric awaitTxId called with txid 123
ts/db:electric new txids synced from pg [123]
ts/db:electric awaitTxId found match for txid 123
// Resolves immediately!
```

**The Solution**: Query txid INSIDE the transaction (see Phase 3 examples).

#### 7.3 Alternative Sync Strategies (if txid issues persist)

If you cannot get txid matching working, use `awaitMatch`:

```typescript
import { isChangeMessage } from '@tanstack/electric-db-collection'

onInsert: async ({ transaction }) => {
  const newItem = transaction.mutations[0].modified
  await api.todos.create(newItem)

  // Wait for matching message instead of txid
  await collection.utils.awaitMatch(
    (message) => {
      return (
        isChangeMessage(message) &&
        message.headers.operation === 'insert' &&
        message.value.id === newItem.id
      )
    },
    5000, // timeout in ms
  )
}
```

Or use simple timeout for prototyping:

```typescript
onInsert: async ({ transaction }) => {
  const newItem = transaction.mutations[0].modified
  await api.todos.create(newItem)

  // Simple timeout - crude but usually works
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
```

## File Structure Changes

```
src/
├── db/
│   ├── collections.ts          # electricTodosCollection + localTodosCollection
│   ├── schema.ts               # Drizzle table schema
│   └── connection.ts           # PostgreSQL pool connection (migrations only)
├── lib/
│   └── supabase.ts            # NEW: Supabase client for writes
├── composables/
│   ├── useTodos.ts            # Keep for backward compatibility
│   ├── useElectricTodos.ts    # Main composable for electric sync
│   ├── useNetworkStatus.ts    # Online/offline detection
│   └── useMigration.ts        # LocalStorage → Electric migration
├── components/
│   └── SyncStatus.vue         # Sync status indicator
├── drizzle.config.ts          # Drizzle Kit configuration
└── ...
```

## Environment Variables Required

```bash
# .env.local

# =============================================================================
# DATABASE (for migrations only - used by Drizzle Kit CLI)
# NOT exposed to frontend - keep this secret!
# =============================================================================
DATABASE_URL=postgresql://postgres.wbsgscgtlbakvuwtitof:KFamqQYz2ykOE9Kf@aws-1-eu-west-1.pooler.supabase.com:5432/postgres

# =============================================================================
# ELECTRIC CLOUD (used by frontend for READS)
# =============================================================================
VITE_ELECTRIC_SHAPE_URL=https://api.electric-sql.cloud/v1/shape
VITE_ELECTRIC_SOURCE_ID=svc-rude-peacock-bxymgk1c1m
VITE_ELECTRIC_SECRET=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# =============================================================================
# SUPABASE (used by frontend for WRITES) - NEW
# =============================================================================
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-publishable-key

# =============================================================================
# APP CONFIGURATION
# =============================================================================
VITE_DEVICE_ID=desktop-chrome-001  # Unique per device/browser instance
```

**Important Notes:**

1. **DATABASE_URL**: Only used by Drizzle Kit CLI for migrations. Never import this in frontend code.

2. **VITE\_\* variables**: Automatically exposed to frontend by Vite. These are required for Electric Cloud and Supabase connections.

3. **Dual write path**: The app uses Supabase SDK for writes (POST/PUT/DELETE) and Electric Cloud for reads (shape stream). This is the recommended pattern.

4. **Pseudo-txid**: Using `Date.now()` as txid works well because Electric Cloud syncs changes in real-time. For stricter ordering, you could use Edge Functions with real PostgreSQL txid.

5. **VITE_DEVICE_ID**: Used to track which device created/modified todos. Generate a unique ID per device/browser combination.

## Setup Steps

1. **Sign up for Electric Cloud**: https://electric-sql.cloud
2. **Create a new source** and connect your Supabase Postgres database using the `DATABASE_URL`
3. **Configure the source** in Electric Cloud dashboard:
   - Note your `SOURCE_ID` and `SECRET` (shown after creating the source)
   - Configure the shape URL
4. **Get Supabase credentials**:
   - Go to Supabase Dashboard → Settings → API
   - Copy `Project URL` as `VITE_SUPABASE_URL`
   - Copy `publishable public` key as `VITE_SUPABASE_KEY`
5. **Add environment variables** to `.env.local`:
   ```
   VITE_ELECTRIC_SOURCE_ID=your-source-id
   VITE_ELECTRIC_SECRET=your-secret
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_KEY=your-publishable-key
   ```
6. **Install Supabase SDK**: `npm install @supabase/supabase-js`
7. **Run migrations**: `npm run migrate` to create the todos table
8. **Test**: Run `npm run dev` and verify sync works

## Next Steps

1. **Verify Electric Cloud connection**: Ensure shape URL is working
2. **Install Supabase SDK**: `npm install @supabase/supabase-js`
3. **Create Supabase client**: Create `src/lib/supabase.ts`
4. **Update collections.ts**: Use Supabase SDK in mutation handlers
5. **Test locally**: Run through all test scenarios

## Success Metrics

### Sync Performance:

- ✅ Sync time < 1 second for new todos
- ✅ Real-time updates across devices (sub-second)
- ✅ Offline operations work seamlessly
- ✅ No data loss during migration
- ✅ Automatic conflict resolution (no manual intervention)
- ✅ No txid timeouts or stalls

### Database Management:

- ✅ Drizzle migrations generate correct SQL
- ✅ `npm run migrate` applies migrations successfully
- ✅ Schema changes tracked in version control (`src/db/out/`)
- ✅ Database schema matches Drizzle schema definition
- ✅ No manual SQL required for schema changes

## Important Notes

### Critical Implementation Details:

- **CRITICAL**: Query `pg_current_xact_id()::xid::text` INSIDE the transaction that performs the mutation (handled by Electric Cloud proxy)
- Electric handles all conflict resolution automatically via Postgres txids
- No custom CRDT logic needed
- Offline queue is handled by TanStack DB's optimistic updates
- Multi-device sync is automatic via Electric shapes
- Future multi-user support: Add `user_id` column and RLS policies

### Option 2 Specific Notes:

- **No backend server required** - Frontend connects directly to Electric Cloud
- **Drizzle is only for migrations** - Not used for runtime queries
- **DATABASE_URL is CLI-only** - Never import in frontend code
- **VITE_ELECTRIC_SECRET is exposed** - This is acceptable for single-user apps, but consider Option A (backend proxy) for multi-user apps with sensitive data
- **Migration workflow**: Edit schema.ts → Generate migration → Review SQL → Apply to database

### Security Considerations for Option 2:

⚠️ **Direct Electric Cloud connection exposes credentials in frontend**:

- `VITE_ELECTRIC_SECRET` is visible in browser dev tools
- Acceptable for: Personal apps, prototypes, low-security data
- NOT recommended for: Multi-user apps, sensitive data, production customer-facing apps

**Migration to Option A (backend proxy) later**:

1. Create a backend API (Express/Hono/Fastify)
2. Move Electric credentials to backend environment
3. Update frontend to call your API instead of Electric directly
4. No database migration needed - same PostgreSQL database
