# Cloud Sync Implementation Plan

**Status**: Ready for Implementation  
**Last Updated**: 2026-02-10  
**Decision**: ElectricSQL Cloud + TanStack DB

## Overview

This document outlines the implementation plan for adding cloud synchronization to the AI Todo App using ElectricSQL Cloud and TanStack DB.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Vue 3 App)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │   Components     │◄──►│  useLiveQuery    │◄──►│  Electric        │      │
│  │   (Views/UI)     │    │  (TanStack DB)   │    │  Collection      │      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│         │                                               │                   │
│         │                    Optimistic Updates         │                   │
│         │                    (via API calls)            │                   │
│         ▼                                               │                   │
│  ┌──────────────────┐                                  │                   │
│  │  useTodos()      │──────────────────────────────────┤                   │
│  │  (API calls)     │         Returns txid              │                   │
│  └──────────────────┘                                  │                   │
│         │                                               │                   │
│         │                    Sync via WebSocket         │                   │
│         │                    (Real-time updates)        │                   │
│         ▼                                               ▼                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Electric Cloud Proxy                              │  │
│  │   (Built-in auth + shape configuration + transaction matching)        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  Postgres Replication
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (PostgreSQL)                                │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  TABLE: todos                                                      │    │
│  │  - id (UUID PRIMARY KEY)                                           │    │
│  │  - label (TEXT)                                                    │    │
│  │  - week_number (INTEGER)                                           │    │
│  │  - done (BOOLEAN)                                                  │    │
│  │  - archived (BOOLEAN)                                              │    │
│  │  - created_at (TIMESTAMPTZ)                                        │    │
│  │  - updated_at (TIMESTAMPTZ)                                        │    │
│  │  - device_id (TEXT)  -- For multi-device sync                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Conflict Resolution: Postgres Transaction IDs (Automatic)

ElectricSQL uses Postgres transaction IDs (txids) for deterministic ordering:
- Last committed transaction wins
- No manual conflict resolution needed
- Automatic consistency across all devices
- No Yjs or custom CRDT required

### 2. Write Strategy: Optimistic Updates with txid Matching

```
1. User action → Update local TanStack DB collection (UI updates immediately)
2. Call API → POST/PUT/DELETE to backend
3. Backend → Write to Postgres, return txid
4. Electric → Stream change with txid via WebSocket
5. TanStack DB → Match txid, confirm optimistic update
6. If error → Rollback optimistic update
```

### 3. Proxy: Electric Cloud Built-in

Using Electric Cloud's built-in proxy for:
- Authentication (initially simple device-based, later user-based)
- Shape configuration (which todos to sync)
- Transaction authorization

## Implementation Phases

### Phase 1: Dependencies & Configuration (1-2 hours)

#### 1.1 Install Dependencies

```bash
npm install @tanstack/electric-db-collection @electric-sql/client
```

#### 1.2 Environment Variables

Create `.env.local`:
```
# Electric Cloud
VITE_ELECTRIC_URL=https://<your-instance>.electric-sql.cloud
VITE_ELECTRIC_SHAPE_URL=https://<your-instance>.electric-sql.cloud/v1/shape

# For API calls (writes)
VITE_API_BASE_URL=https://your-backend.com/api

# Device identification
VITE_DEVICE_ID=<generated-or-configured>
```

#### 1.3 Supabase Schema Setup

Run on your Supabase database:

```sql
-- Enable Electric sync on the table
-- (This is handled by Electric Cloud setup, but verify the table exists)

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

### Phase 2: Create Electric Collection (2-3 hours)

#### 2.1 Update collections.ts

```typescript
// src/db/collections.ts
import type { InferOutput } from 'valibot'
import { createCollection } from '@tanstack/vue-db'
import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import {
  boolean,
  maxLength,
  minLength,
  nullable,
  number,
  object,
  pipe,
  regex,
  string,
} from 'valibot'

export const TodoSchema = object({
  id: pipe(string(), minLength(1)),
  label: pipe(
    string(),
    minLength(1, 'Label cannot be empty'),
    maxLength(500, 'Label must be less than 500 characters'),
    regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
  ),
  weekNumber: nullable(number()),
  done: boolean(),
  archived: boolean(),
  createdAt: number(),
  updatedAt: number(),
  deviceId: nullable(string()), // New field for device tracking
})

export type Todo = InferOutput<typeof TodoSchema>

export type TodoFilter
  = | 'backlog'
    | 'current-week'
    | 'future'
    | 'unfinished'
    | 'archived'
    | 'finished'

export const VALID_FILTERS: TodoFilter[] = [
  'backlog',
  'current-week',
  'future',
  'unfinished',
  'archived',
  'finished',
]

// Electric collection for cloud sync
export const electricTodosCollection = createCollection(
  electricCollectionOptions({
    id: 'electric-todos',
    schema: TodoSchema,
    getKey: (item) => item.id,
    shapeOptions: {
      url: `${import.meta.env.VITE_ELECTRIC_SHAPE_URL}/todos`,
      params: {
        // Sync all non-archived todos by default
        // Archived todos can be synced on-demand
      },
    },
    // Persistence handlers for optimistic updates
    onInsert: async (item, { awaitTxId }) => {
      // Call API to insert
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      
      if (!response.ok) {
        throw new Error('Failed to insert todo')
      }
      
      const { txid } = await response.json()
      
      // Wait for Electric to sync this txid
      await awaitTxId(txid)
    },
    onUpdate: async (id, changes, { awaitTxId }) => {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update todo')
      }
      
      const { txid } = await response.json()
      await awaitTxId(txid)
    },
    onDelete: async (id, { awaitTxId }) => {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/todos/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete todo')
      }
      
      const { txid } = await response.json()
      await awaitTxId(txid)
    },
  }),
)

// Keep localStorage as fallback for offline-first
export const localTodosCollection = createCollection(
  localStorageCollectionOptions({
    id: 'local-todos',
    storageKey: 'ai-todo-app-todos',
    getKey: (item) => item.id,
    schema: TodoSchema,
  }),
)

export const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)
```

### Phase 3: Backend API for Writes (3-4 hours)

You need a backend to handle writes and return txids. Options:

#### Option A: Supabase Edge Functions (Recommended for simplicity)

Create `supabase/functions/todos/index.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const method = req.method

  try {
    // Start a transaction
    const { data, error } = await supabase.rpc('begin_transaction')
    if (error) throw error

    let result
    let txid

    switch (method) {
      case 'POST':
        const newTodo = await req.json()
        result = await supabase
          .from('todos')
          .insert(newTodo)
          .select()
          .single()
        break

      case 'PUT':
        const id = url.pathname.split('/').pop()
        const updates = await req.json()
        result = await supabase
          .from('todos')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        break

      case 'DELETE':
        const deleteId = url.pathname.split('/').pop()
        result = await supabase
          .from('todos')
          .delete()
          .eq('id', deleteId)
        break

      default:
        return new Response('Method not allowed', { status: 405 })
    }

    if (result.error) throw result.error

    // Get the transaction ID
    const { data: txData } = await supabase.rpc('get_current_txid')
    txid = txData

    // Commit transaction
    await supabase.rpc('commit_transaction')

    return new Response(JSON.stringify({ 
      success: true, 
      data: result.data,
      txid 
    }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    await supabase.rpc('rollback_transaction')
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

#### Option B: Custom API (Express/Fastify)

If you prefer a separate backend service, create REST endpoints that:
1. Receive todo operations
2. Execute SQL with transaction
3. Return `{ txid, data }`

### Phase 4: Update Composables (2-3 hours)

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
    isOnline.value ? electricTodosCollection : localTodosCollection
  )

  // Live query from active collection
  const { data: todos } = useLiveQuery((q) => 
    q.from({ todo: activeCollection.value })
  )

  // Migration: Upload local todos to cloud
  async function migrateLocalTodos() {
    if (!isOnline.value) return

    isMigrating.value = true
    try {
      const localTodos = localTodosCollection.utils.getAll()
      
      for (const todo of localTodos) {
        // Add device_id
        const todoWithDevice = {
          ...todo,
          deviceId: import.meta.env.VITE_DEVICE_ID,
        }
        
        // Insert via API (will trigger Electric sync)
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/todos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(todoWithDevice),
        })
      }

      // Clear local storage after successful migration
      localTodosCollection.utils.clear()
      
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
    // If online: triggers onInsert handler → API call → await txid
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
        'bg-yellow-500': syncStatus === 'syncing',
        'bg-red-500': !isOnline || syncStatus === 'error',
      }"
    />
    <span class="text-gray-600">
      {{ statusText }}
    </span>
    <button
      v-if="!isOnline"
      @click="migrateLocalTodos"
      class="text-blue-500 hover:text-blue-700"
    >
      Sync when online
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useElectricTodos } from '@/composables/useElectricTodos'

const { isOnline, syncStatus, migrateLocalTodos } = useElectricTodos()

const statusText = computed(() => {
  if (!isOnline.value) return 'Offline'
  if (syncStatus.value === 'syncing') return 'Syncing...'
  if (syncStatus.value === 'error') return 'Sync error'
  return 'Synced'
})
</script>
```

#### 5.2 Update App.vue

Add sync status indicator and migration button:

```vue
<template>
  <div class="app">
    <header>
      <SyncStatus />
      <!-- ... rest of header -->
    </header>
    <!-- ... rest of app -->
  </div>
</template>
```

### Phase 6: Migration from LocalStorage (1-2 hours)

Create `src/composables/useMigration.ts`:

```typescript
import { onMounted, ref } from 'vue'
import { localTodosCollection } from '@/db/collections'
import { useElectricTodos } from './useElectricTodos'

export function useMigration() {
  const hasMigrated = ref(false)
  const { isOnline, migrateLocalTodos } = useElectricTodos()

  onMounted(async () => {
    // Check if there's local data to migrate
    const localTodos = localTodosCollection.utils.getAll()
    
    if (localTodos.length > 0 && isOnline.value) {
      // Ask user or auto-migrate
      const shouldMigrate = confirm(
        `Found ${localTodos.length} local todos. Upload to cloud?`
      )
      
      if (shouldMigrate) {
        await migrateLocalTodos()
        hasMigrated.value = true
      }
    }
  })

  return { hasMigrated }
}
```

### Phase 7: Testing & Polish (2-3 hours)

#### 7.1 Testing Checklist

- [ ] Add todo → appears immediately → syncs to cloud → appears on other device
- [ ] Edit todo on device A → updates on device B in real-time
- [ ] Go offline → add todo → go online → todo syncs to cloud
- [ ] Migration: LocalStorage todos upload to cloud correctly
- [ ] Concurrent edits: Last write wins (Postgres txid ordering)
- [ ] Large todo list performance (>100 todos)
- [ ] Error handling: Failed API calls roll back optimistic updates

#### 7.2 Add Error Boundaries

Wrap collection operations with error handling:

```typescript
// In useElectricTodos
function handleOperationError(error: Error, operation: string) {
  syncStatus.value = 'error'
  console.error(`${operation} failed:`, error)
  // Could add toast notification here
}
```

## File Structure Changes

```
src/
├── db/
│   └── collections.ts          # Add electricTodosCollection
├── composables/
│   ├── useTodos.ts             # Keep for backward compatibility
│   ├── useElectricTodos.ts     # NEW: Main composable for electric sync
│   ├── useNetworkStatus.ts     # NEW: Online/offline detection
│   └── useMigration.ts         # NEW: LocalStorage → Electric migration
├── components/
│   └── SyncStatus.vue          # NEW: Sync status indicator
└── ...
```

## Environment Variables Required

```bash
# .env.local
VITE_ELECTRIC_URL=https://<your-instance>.electric-sql.cloud
VITE_ELECTRIC_SHAPE_URL=https://<your-instance>.electric-sql.cloud/v1/shape
VITE_API_BASE_URL=https://<your-supabase-project>.supabase.co/functions/v1
VITE_DEVICE_ID=desktop-chrome-001  # Unique per device
```

## Next Steps

1. **Verify Electric Cloud setup**: Ensure shape URL is working
2. **Create backend API**: Choose between Supabase Edge Functions or custom API
3. **Test locally**: Run through all test scenarios
4. **Deploy**: Update production environment variables
5. **Monitor**: Check sync performance and error rates

## Success Metrics

- ✅ Sync time < 1 second for new todos
- ✅ Real-time updates across devices (sub-second)
- ✅ Offline operations work seamlessly
- ✅ No data loss during migration
- ✅ Automatic conflict resolution (no manual intervention)

## Notes

- Electric handles all conflict resolution automatically via Postgres txids
- No custom CRDT logic needed
- Offline queue is handled by TanStack DB's optimistic updates
- Multi-device sync is automatic via Electric shapes
- Future multi-user support: Add `user_id` column and RLS policies
