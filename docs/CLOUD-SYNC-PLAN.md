# PLAN-CLOUD-SYNC.md

**IMPORTANT: This plan needs to be reviewed and updated before starting implementation.**

## Overview

This document outlines the comprehensive plan for implementing cloud synchronization with Supabase, CRDTs, and offline-first support for the AI Todo App.

## Architecture Decision Record (ADR)

### ADR-001: CRDT Library Selection

**Decision**: Use Yjs for CRDT implementation

**Status**: ✅ DECIDED

**Rationale**:
- Proven CRDT implementation with extensive documentation
- Excellent Vue 3 integration support
- Compatible with TanStack DB reactivity model
- Works seamlessly with Supabase via WebSocket providers
- Large community and active development

**Alternatives Considered**:
- **SyncedStore**: Simpler API but less mature ecosystem
- **Automerge**: Document-based CRDTs, more complex for todo app

---

### ADR-002: Local Database Package Selection

**Decision**: TanStack DB (LocalStorage) - Migration completed ✅

**Status**: ✅ DECIDED & IMPLEMENTED

**Current Implementation**:
- **TanStack DB**: Reactive queries with LocalStorage persistence
- **Version**: @tanstack/react-db (latest)
- **Features**: Live queries, automatic reactivity, cross-tab sync, valibot validation

**Migration from Dexie.js**:
- **Previous**: Dexie.js 4.2.1 with IndexedDB
- **Current**: TanStack DB with LocalStorage collection options
- **Rationale**: Better Vue 3 reactivity integration, simpler API, automatic sync across tabs

**Key Features**:
- **Live Queries**: `useLiveQuery()` provides automatic reactivity
- **LocalStorage**: `localStorageCollectionOptions` for persistence
- **Cross-tab Sync**: Enabled by default via storage events
- **Validation**: valibot schemas for import/export validation
- **Simplicity**: Synchronous CRUD operations (no async/await needed)

---

### ADR-001: CRDT Library Selection

**Open Decisions**:
- ⚠️ **DECISION NEEDED**: Confirm Yjs is the best choice for our use case
- ⚠️ **DECISION NEEDED**: Verify compatibility with existing Vue 3 + TypeScript setup

---

### ADR-002: Sync Strategy

**Decision**: Hybrid approach (TanStack DB + Supabase)

**Status**: ✅ DECIDED

**Rationale**:
- TanStack DB for local storage with automatic reactivity and cross-tab sync
- Use Supabase for cloud sync and real-time updates
- Implement sync queue for offline operations
- Provide immediate UI feedback with optimistic updates
- Valibot validation for data integrity

**Current Implementation**:
- Collections defined in `src/db/collections.ts`
- Live queries via `useLiveQuery()` in composables
- Cross-tab sync enabled via LocalStorage events
- Import/export with valibot validation schemas

**Open Decisions**:
- ⚠️ **DECISION NEEDED**: Confirm sync queue implementation details
- ⚠️ **DECISION NEEDED**: Define conflict resolution strategy

---

### ADR-003: Authentication Approach

**Decision**: GitHub OAuth with pre-configured users

**Status**: ✅ DECIDED

**Rationale**:
- Single-user app initially, but future collaboration planned
- GitHub OAuth provides secure authentication
- Pre-configured user list ensures controlled access
- Supabase handles user management and permissions

**Open Decisions**:
- ⚠️ **DECISION NEEDED**: Define allowed user list management
- ⚠️ **DECISION NEEDED**: Confirm email-based vs GitHub ID-based access

---

## Technical Implementation Plan

### Phase 1: Core Infrastructure (Weeks 1-2)

#### 1.1 Supabase Setup
```bash
# Dependencies
npm install @supabase/supabase-js

# Environment variables
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 1.2 Database Schema
```sql
-- Users table (Supabase auth)
-- Todos table with CRDT support
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  week_number INTEGER,
  done BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  crdt_state JSONB DEFAULT '{}' -- For CRDT synchronization
);

-- Indexes for performance
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_week_number ON todos(week_number);
CREATE INDEX idx_todos_done ON todos(done);
CREATE INDEX idx_todos_archived ON todos(archived);
```

#### 1.3 CRDT Integration
```typescript
// src/lib/crdt.ts
import * as Y from 'yjs'
import { useLiveQuery } from '@tanstack/react-db'
import { todosCollection } from '@/db/collections'

export function createCRDTStore() {
  const ydoc = new Y.Doc()

  // TanStack DB persistence via LocalStorage (already handles reactivity)
  // No additional persistence layer needed - TanStack DB handles this
  const todos = useLiveQuery(() => todosCollection.findMany({}))

  // CRDT updates will be applied to TanStack DB via sync queue
  return { ydoc, todos }
}
```

### Phase 2: Sync Architecture (Weeks 3-4)

#### 2.1 Sync Queue System
```typescript
// src/composables/useSyncQueue.ts
export interface SyncOperation {
  type: 'create' | 'update' | 'delete'
  data: Todo
  timestamp: number
  crdtUpdate?: Uint8Array
}

export function useSyncQueue() {
  const queue = ref<SyncOperation[]>([])
  const isSyncing = ref(false)

  function addToQueue(operation: SyncOperation) {
    queue.value.push(operation)
  }

  async function processQueue(): Promise<void> {
    if (isSyncing.value)
      return

    isSyncing.value = true
    while (queue.value.length > 0) {
      const operation = queue.value[0]
      try {
        await syncOperation(operation)
        queue.value.shift()
      }
      catch (error) {
        // Handle sync failure
        console.error('Sync failed:', error)
        break
      }
    }
    isSyncing.value = false
  }

  return { queue, addToQueue, processQueue }
}
```

#### 2.2 Conflict Resolution Strategy
```typescript
// src/lib/conflictResolver.ts
export function resolveConflict(
  localTodo: Todo,
  remoteTodo: Todo,
  crdtUpdate: Uint8Array
): Todo {
  // CRDT automatically resolves conflicts
  // Use vector clocks for deterministic resolution
  // Fallback to last-writer-wins if needed

  // CRDT approach: apply remote changes, let CRDT merge
  Y.applyUpdate(localTodo.crdtState, crdtUpdate)

  // Return merged result
  return {
    ...localTodo,
    ...remoteTodo,
    crdtState: localTodo.crdtState.toJSON()
  }
}
```

### Phase 3: Vue 3 Integration (Weeks 5-6)

#### 3.1 Todo Operations with CRDT
```typescript
// src/composables/useTodosWithSync.ts
import { useSyncQueue } from '@/composables/useSyncQueue'
import { todosCollection } from '@/db/collections'
import { useLiveQuery } from '@tanstack/vue-db'
import { computed, ref } from 'vue'

export function useTodosWithSync() {
  const { addToQueue, processQueue } = useSyncQueue()
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Live query for todos
  const { data: todos } = useLiveQuery(q =>
    q.from({ todo: todosCollection })
  )

  // Local operations
  async function addTodo(label: string, weekNumber: number | null) {
    const todo = {
      id: crypto.randomUUID(),
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Add to TanStack DB
    todosCollection.insert(todo)

    // Queue for sync
    addToQueue({
      type: 'create',
      data: todo,
      timestamp: Date.now()
    })
  }

  async function updateTodo(id: string, updates: Partial<Todo>) {
    todosCollection.update(id, (draft) => {
      Object.assign(draft, updates, { updatedAt: Date.now() })
    })

    addToQueue({
      type: 'update',
      data: { id, ...updates },
      timestamp: Date.now()
    })
  }

  // Sync operations
  async function syncWithCloud() {
    try {
      loading.value = true

      // Upload local changes
      const localChanges = getPendingChanges()
      await supabase.from('todos').upsert(localChanges)

      // Download remote changes
      const remoteTodos = await supabase
        .from('todos')
        .select('*')
        .order('updated_at', { ascending: false })

      // Merge using CRDT
      mergeWithCRDT(remoteTodos)

      // Process sync queue
      await processQueue()
    }
    catch (err) {
      error.value = `Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
    finally {
      loading.value = false
    }
  }

  return {
    todos: computed(() => todos.value ?? []),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    addTodo,
    updateTodo,
    syncWithCloud
  }
}
```

#### 3.2 Real-time Updates
```typescript
// src/composables/useRealtimeSync.ts
export function useRealtimeSync() {
  const channel = supabase.channel('todos')

  function subscribeToChanges(callback: (payload: any) => void) {
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'todos'
      }, callback)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  return { subscribeToChanges }
}
```

### Phase 4: Advanced Features (Weeks 7-8)

#### 4.1 Network Status Detection
```typescript
// src/composables/useNetworkStatus.ts
export function useNetworkStatus() {
  const isOnline = ref(navigator.onLine)

  function handleOnline() {
    isOnline.value = true
    // Trigger sync when back online
    syncManager.syncWhenOnline()
  }

  function handleOffline() {
    isOnline.value = false
  }

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
```

#### 4.2 Authentication Integration
```typescript
// src/composables/useAuth.ts
export function useAuth() {
  const { data: session, error } = await supabase.auth.getSession()

  // GitHub OAuth setup
  async function signInWithGitHub() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github'
    })
    return { data, error }
  }

  // Restrict to pre-configured users
  async function isAllowedUser(email: string): Promise<boolean> {
    // Check against allowed emails list
    // Or check user roles/permissions
    return allowedEmails.includes(email)
  }

  return { session, signInWithGitHub, isAllowedUser }
}
```

## Open Decisions and Questions

### Decision 1: CRDT Library Implementation
**Question**: Should we use Yjs or SyncedStore for CRDT implementation?

**Considerations**:
- Yjs has more mature ecosystem and documentation
- SyncedStore has Vue 3 native bindings
- Yjs compatible with TanStack DB reactivity patterns
- SyncedStore may have simpler API

**Recommendation**: Proceed with Yjs based on current research, but verify compatibility with existing Vue 3 + TypeScript setup.

### Decision 2: Conflict Resolution Strategy
**Question**: How should we handle complex conflicts that CRDT cannot resolve automatically?

**Options**:
1. **Last-Writer-Wins**: Simple but may lose data
2. **User Intervention**: Show conflict dialog with options
3. **Merge Strategy**: Attempt to merge conflicting changes

**Recommendation**: Implement user intervention for complex conflicts, with CRDT handling simple cases automatically.

### Decision 3: Sync Trigger Strategy
**Question**: When should automatic sync be triggered?

**Options**:
1. **Immediate**: Sync after every change
2. **Batch**: Sync periodically or on app background
3. **Network-based**: Sync when online status changes
4. **Hybrid**: Immediate for small changes, batch for large operations

**Recommendation**: Hybrid approach - immediate for small changes, batch for large operations, always sync when online status changes.

### Decision 4: Allowed User Management
**Question**: How should we manage the list of allowed GitHub users?

**Options**:
1. **Static List**: Hardcoded in environment variables
2. **Database Table**: Dynamic management via Supabase
3. **GitHub Team**: Use GitHub team membership for access control

**Recommendation**: Start with static list in environment variables, migrate to database table for dynamic management.

## Implementation Risks and Mitigation

### Risk 1: CRDT Complexity
**Impact**: High
**Mitigation**:
- Start with simple CRDT implementation
- Add complexity gradually
- Comprehensive testing of conflict scenarios
- Fallback to simpler conflict resolution if needed

### Risk 2: Offline Sync Reliability
**Impact**: High
**Mitigation**:
- Implement robust sync queue with retry logic
- TanStack DB with LocalStorage provides reliable offline storage
- Cross-tab sync enabled via storage events
- Provide clear user feedback on sync status
- Handle network interruptions gracefully

### Risk 3: Performance Issues
**Impact**: Medium
**Mitigation**:
- Implement batch operations for multiple changes
- Use incremental sync to reduce bandwidth
- Optimize database queries and indexes
- Monitor performance and optimize bottlenecks

### Risk 4: Authentication Complexity
**Impact**: Medium
**Mitigation**:
- Start with simple GitHub OAuth implementation
- Implement pre-configured user list first
- Add dynamic user management later
- Provide clear error messages for authentication failures

## Success Metrics

### Functional Metrics
- ✅ Offline functionality works completely
- ✅ Real-time updates when online
- ✅ Conflict resolution handles all scenarios
- ✅ GitHub authentication works for allowed users

### Performance Metrics
- Sync time < 2 seconds for 50 todos
- Offline operations complete < 100ms
- Memory usage < 50MB for 1000 todos
- Battery impact < 5% during normal usage

### User Experience Metrics
- No data loss in any scenario
- Clear sync status indicators
- Intuitive conflict resolution
- Smooth offline-to-online transitions

## Testing Strategy

### Unit Tests
- CRDT conflict resolution
- Sync queue operations
- Conflict detection and resolution
- Offline-to-online transition

### Integration Tests
- Full sync flow
- Network interruption scenarios
- Concurrent edit conflicts
- Authentication flow

### E2E Tests
- Real user workflows
- Offline usage patterns
- Sync reliability
- Conflict scenarios

## Prerequisites for Implementation

### Environment Setup
- Supabase project created
- Database schema deployed
- Environment variables configured
- GitHub OAuth application created

### Development Setup
- Node.js 18+ installed
- Vue 3 + TypeScript project configured
- Testing framework set up
- CI/CD pipeline configured

### Knowledge Requirements
- Vue 3 Composition API
- TypeScript best practices
- Supabase authentication and database
- CRDT concepts and implementation
- Offline-first application patterns

## Next Steps

### Immediate Actions (Before Implementation)
1. **Review and Update Plan**: All stakeholders review this plan and provide feedback
2. **Confirm Decisions**: Make final decisions on open questions
3. **Environment Setup**: Ensure Supabase and development environment are ready
4. **Team Alignment**: Ensure all team members understand the architecture and approach

### Implementation Preparation
1. **Create Implementation Tasks**: Break down plan into actionable development tasks
2. **Setup Development Environment**: Configure local development with Supabase
3. **Create Test Data**: Prepare test data for various scenarios
4. **Define Success Criteria**: Establish clear acceptance criteria for each phase

### Implementation Phases
1. **Phase 1**: Core infrastructure (Supabase, CRDT, sync queue)
2. **Phase 2**: Vue 3 integration and real-time updates
3. **Phase 3**: Advanced features (network detection, authentication)
4. **Phase 4**: Testing, optimization, and polish

---

**Note**: This plan is a living document and should be updated as implementation progresses and new insights are gained. Regular review meetings should be scheduled to ensure the plan remains aligned with project goals and constraints.
