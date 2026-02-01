# Migration Plan: Dexie.js → TanStack DB (LocalStorage)

## Executive Summary

This document outlines the migration from Dexie.js to TanStack DB using LocalStorage Collection for the AI Todo App.

**Key Decision**: With < 1000 todos, LocalStorage Collection is appropriate and provides significant benefits:
- ✅ Well within 5-10MB storage limit (~500KB-1MB expected usage)
- ✅ Simple, synchronous API (no async/await for mutations)
- ✅ Automatic cross-tab synchronization
- ✅ Built-in optimistic updates with rollback
- ✅ Removes Dexie dependency entirely

## Current State Analysis

### Dexie.js Usage
- **Database**: `TodoAppDB` (IndexedDB)
- **Table**: `todos` with indexes on `id, weekNumber, done, archived, createdAt, updatedAt`
- **Files using Dexie**:
  - `src/db/db.ts` - Database initialization
  - `src/composables/useTodos.ts` - CRUD operations
  - `src/composables/useDataExport.ts` - Import/export with transactions
  - `src/stores/todos.ts` - Indirect usage via composables

### Data Model with Valibot Schema

**TypeScript Interface** (inferred from schema):
```typescript
interface Todo {
  id: string
  label: string
  weekNumber: number | null
  done: boolean
  archived: boolean
  createdAt: number
  updatedAt: number
}
```

**Valibot Schema Definition**:
```typescript
import { object, string, number, boolean, pipe, minLength, maxLength, regex } from 'valibot'

export const TodoSchema = object({
  id: pipe(string(), minLength(1)),
  label: pipe(
    string(),
    minLength(1, 'Label cannot be empty'),
    maxLength(500, 'Label must be less than 500 characters'),
    regex(/^[a-zA-Z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters')
  ),
  weekNumber: number(),
  done: boolean(),
  archived: boolean(),
  createdAt: number(),
  updatedAt: number(),
})
```

## Why LocalStorage Collection?

### Pros ✅

1. **Ultra-simple API**
   - No async/await for mutations (synchronous operations)
   - No mutation handlers required
   - Direct state mutations that auto-persist to localStorage

2. **Cross-tab synchronization** (Bonus feature)
   - Changes sync instantly across browser tabs
   - Works via storage events automatically

3. **Optimistic updates built-in**
   - Changes appear immediately in UI
   - Automatic rollback on errors

4. **Live queries work seamlessly**
   - Reactive updates when data changes
   - Same query builder API (`eq`, `gt`, `lt`, etc.)

5. **Cleaner architecture**
   - Removes dexie dependency entirely
   - Single storage key vs complex IndexedDB schema

### Cons ⚠️

1. **Storage limits**
   - LocalStorage: 5-10MB total per origin
   - All todos stored in ONE JSON string
   - With < 1000 todos: ~500KB-1MB (safe)

2. **Synchronous operations**
   - `JSON.stringify()` / `JSON.parse()` on every mutation
   - Could block UI with very large datasets
   - Not an issue with < 1000 todos

3. **No database indexing**
   - LocalStorage stores one JSON blob
   - TanStack DB does in-memory filtering
   - Acceptable for small datasets

4. **Data loss on migration**
   - All existing IndexedDB data will be lost
   - Clean slate approach

## Schema Validation with Valibot

TanStack DB supports Standard Schema v1, which means it works seamlessly with Valibot. This provides runtime validation and type safety.

### Todo Schema

```typescript
import { object, string, number, boolean, pipe, minLength, maxLength, regex } from 'valibot'
import type { Output } from 'valibot'

// Main Todo schema for collection
export const TodoSchema = object({
  id: pipe(string(), minLength(1)),
  label: pipe(
    string(),
    minLength(1, 'Label cannot be empty'),
    maxLength(500, 'Label must be less than 500 characters'),
    regex(/^[a-zA-Z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters')
  ),
  weekNumber: number(), // null handled by TypeScript
  done: boolean(),
  archived: boolean(),
  createdAt: number(),
  updatedAt: number(),
})

// Infer type from schema
export type Todo = Output<typeof TodoSchema>

// Label-only validation for UI forms
export const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-zA-Z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters')
)
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `id` | Required string | N/A (system generated) |
| `label` | 1-500 chars | "Label must be 1-500 characters" |
| `label` | Valid chars only | "Invalid characters in label" |
| `weekNumber` | Number or null | N/A |
| `done` | Boolean | N/A |
| `archived` | Boolean | N/A |
| `createdAt` | Number (timestamp) | N/A |
| `updatedAt` | Number (timestamp) | N/A |

### Why Valibot?

1. **Standard Schema v1 compatible**: Works natively with TanStack DB
2. **Tree-shakeable**: Only imports what you use, smaller bundles
3. **Type inference**: Single source of truth for types and validation
4. **Great error messages**: Clear, actionable validation errors
5. **Faster than Zod**: Better runtime performance
6. **DX-friendly**: Similar API to Zod but lighter

### Usage Examples

**Validating user input**:
```typescript
import { safeParse } from 'valibot'
import { TodoLabelSchema } from '@/db/collections'

function validateLabel(label: string): string | null {
  const result = safeParse(TodoLabelSchema, label)
  if (!result.success) {
    return result.issues[0].message
  }
  return null
}
```

**Collection with validation**:
```typescript
const todosCollection = createCollection(
  localStorageCollectionOptions({
    id: 'todos',
    storageKey: 'ai-todo-app-todos',
    getKey: (item) => item.id,
    schema: TodoSchema, // Runtime validation on insert/update
  })
)
```

**Import validation**:
```typescript
const result = safeParse(array(TodoSchema), importedData.todos)
if (!result.success) {
  console.error('Invalid todo data:', result.issues)
  return { success: false, message: 'Invalid data format' }
}
```

## Implementation Phases

### Phase 1: Dependencies (30 minutes)

**Files**: `package.json`, `package-lock.json`

```bash
npm install @tanstack/vue-db
npm uninstall dexie
```

### Phase 2: Create Collection with Valibot Schemas (30 minutes)

**New file**: `src/db/collections.ts`

```typescript
import { createCollection } from '@tanstack/vue-db'
import { localStorageCollectionOptions } from '@tanstack/vue-db'
import { object, string, number, boolean, pipe, minLength, maxLength, regex } from 'valibot'
import type { Output } from 'valibot'

// Valibot schema for Todo validation
export const TodoSchema = object({
  id: pipe(string(), minLength(1)),
  label: pipe(
    string(),
    minLength(1, 'Label cannot be empty'),
    maxLength(500, 'Label must be less than 500 characters'),
    regex(/^[a-zA-Z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters')
  ),
  weekNumber: number(), // can be null via TypeScript type
  done: boolean(),
  archived: boolean(),
  createdAt: number(),
  updatedAt: number(),
})

// Infer TypeScript type from schema
export type Todo = Output<typeof TodoSchema>

// Create collection with valibot schema for runtime validation
export const todosCollection = createCollection(
  localStorageCollectionOptions({
    id: 'todos',
    storageKey: 'ai-todo-app-todos',
    getKey: (item) => item.id,
    schema: TodoSchema, // Valibot schema for validation
  })
)

// Label validation helper for UI
export const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-zA-Z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters')
)
```

**Key Benefits of Valibot Integration**:
- ✅ Runtime validation of all todo data
- ✅ Type inference from schemas (single source of truth)
- ✅ Label validation rules (1-500 chars, specific characters)
- ✅ Standard Schema v1 compatible (works with TanStack DB)
- ✅ Better error messages for validation failures

### Phase 3: Update Composables (2-3 hours)

**File**: `src/composables/useTodos.ts`

Replace all Dexie operations:

| Current (Dexie) | New (TanStack DB) |
|----------------|-------------------|
| `db.todos.toArray()` | Remove (use live queries) |
| `db.todos.add(todo)` | `todosCollection.insert(todo)` |
| `db.todos.update(id, changes)` | `todosCollection.update(id, (draft) => { ... })` |
| `db.todos.delete(id)` | `todosCollection.delete(id)` |
| `db.todos.get(id)` | Query from collection utils |

**Key changes**:
- Remove async/await where not needed (mutations are synchronous)
- Remove Dexie imports
- Use collection methods directly

### Phase 4: Migrate Store (2-3 hours)

**File**: `src/stores/todos.ts`

Major refactoring:

1. **Replace Pinia state**:
```typescript
// Remove this:
const todos = ref<Todo[]>([])

// Add this:
import { useLiveQuery, eq, gt, lt, and, or } from '@tanstack/vue-db'
import { todosCollection } from '@/db/collections'

const { data: todos } = useLiveQuery((q) => 
  q.from({ todo: todosCollection })
)
```

2. **Convert filtered views to live queries**:
```typescript
// Replace computed filters:
const filteredTodos = computed(() => {
  switch (filter) {
    case 'backlog':
      return todos.value.filter(t => t.weekNumber === null && !t.archived)
    case 'current-week':
      return todos.value.filter(t => t.weekNumber === currentWeek && !t.archived)
    // ... other cases
  }
})

// With live queries:
const currentWeek = computed(() => weekNumber.value)

const { data: backlogTodos } = useLiveQuery((q) =>
  q
    .from({ todo: todosCollection })
    .where(({ todo }) => eq(todo.weekNumber, null))
    .where(({ todo }) => eq(todo.archived, false))
)

const { data: currentWeekTodos } = useLiveQuery((q) =>
  q
    .from({ todo: todosCollection })
    .where(({ todo }) => eq(todo.weekNumber, currentWeek.value))
    .where(({ todo }) => eq(todo.archived, false))
)

// ... create live queries for each filter
```

3. **Keep action methods** for component compatibility:
```typescript
// Keep these methods but update implementation:
async function addTodo(label: string, weekNumber: number | null) {
  const id = crypto.randomUUID()
  const now = Date.now()
  
  todosCollection.insert({
    id,
    label,
    weekNumber,
    done: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  })
  
  return id
}

async function updateTodo(id: string, updates: Partial<Todo>) {
  todosCollection.update(id, (draft) => {
    Object.assign(draft, updates, { updatedAt: Date.now() })
  })
}

async function deleteTodo(id: string) {
  todosCollection.delete(id)
}

async function toggleTodoDone(id: string) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) {
    todosCollection.update(id, (draft) => {
      draft.done = !todo.done
      draft.updatedAt = Date.now()
    })
  }
}

async function archiveTodo(id: string) {
  todosCollection.update(id, (draft) => {
    draft.archived = true
    draft.updatedAt = Date.now()
  })
}
```

### Phase 5: Update Import/Export with Valibot Validation (1 hour)

**File**: `src/composables/useDataExport.ts`

Replace Dexie transaction with TanStack DB utilities and valibot validation:

```typescript
import { parse, array, object, string, number, boolean } from 'valibot'
import { TodoSchema } from '@/db/collections'

// Export function
function exportTodos(): string {
  const allTodos = todosCollection.utils.getAll()
  const exportData = {
    version: '2',
    exportedAt: new Date().toISOString(),
    todos: allTodos,
  }
  return JSON.stringify(exportData, null, 2)
}

// Import validation schemas
const ExportDataSchema = object({
  version: string(),
  exportedAt: string(),
  todos: array(TodoSchema),
})

// Import function with valibot validation
async function importTodos(jsonString: string): Promise<ImportResult> {
  try {
    // Parse JSON
    const parsed = JSON.parse(jsonString)
    
    // Validate structure with valibot
    const validatedData = parse(ExportDataSchema, parsed)
    const validatedTodos = validatedData.todos
    
    // Clear existing data
    await todosCollection.utils.clear()
    
    // Insert validated todos
    await todosCollection.utils.bulkInsert(validatedTodos)
    
    return {
      success: true,
      message: `Imported ${validatedTodos.length} todos`,
      count: validatedTodos.length,
    }
  } catch (error) {
    // Valibot provides detailed error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Import failed: ${errorMessage}`,
      count: 0,
    }
  }
}
```

**Benefits**:
- Schema validation on import ensures data integrity
- Valibot's tree-shakeable design keeps bundle size small
- Type-safe validation with clear error messages

### Phase 6: Cleanup (30 minutes)

**Delete**:
- `src/db/db.ts` (Dexie database file)

**Update**:
- Remove all `import Dexie from 'dexie'` statements
- Remove Dexie type imports
- Update any remaining references

## API Changes Reference

### Before (Dexie)
```typescript
// Database setup
class TodoDatabase extends Dexie {
  todos!: Table<Todo, string>
  constructor() {
    super('TodoAppDB')
    this.version(1).stores({
      todos: 'id, weekNumber, done, archived, createdAt, updatedAt',
    })
  }
}

// CRUD
await db.todos.add(todo)
await db.todos.update(id, changes)
await db.todos.delete(id)
const all = await db.todos.toArray()
const one = await db.todos.get(id)

// Transaction
await db.transaction('rw', db.todos, async () => {
  // ... operations
})
```

### After (TanStack DB with Valibot)
```typescript
// Collection setup with valibot schema
import { TodoSchema } from './collections'

const todosCollection = createCollection(
  localStorageCollectionOptions({
    id: 'todos',
    storageKey: 'ai-todo-app-todos',
    getKey: (item) => item.id,
    schema: TodoSchema, // Runtime validation
  })
)

// CRUD (synchronous!)
todosCollection.insert(todo) // Validates against TodoSchema
todosCollection.update(id, (draft) => { ...changes })
todosCollection.delete(id)

// Query
const { data: all } = useLiveQuery((q) => 
  q.from({ todo: todosCollection })
)
const one = todosCollection.utils.get(id)

// Batch operations
await todosCollection.utils.bulkInsert(todos)
await todosCollection.utils.clear()

// Validation in forms
import { safeParse } from 'valibot'
import { TodoLabelSchema } from './collections'

const result = safeParse(TodoLabelSchema, userInput)
if (!result.success) {
  showError(result.issues[0].message)
}
```

## Testing Checklist

### Core Functionality
- [ ] Add new todo appears immediately in UI
- [ ] Update todo text works
- [ ] Update todo week number works
- [ ] Toggle todo done status works
- [ ] Delete todo removes from list
- [ ] Archive todo moves to archived view
- [ ] Data persists after browser refresh
- [ ] Data persists after closing/reopening browser

### Filter Views
- [ ] Backlog view shows only unarchived todos with weekNumber = null
- [ ] Current week view shows only unarchived todos for current week
- [ ] Future view shows only unarchived todos for future weeks
- [ ] Unfinished view shows only unarchived, incomplete todos from past weeks
- [ ] Finished view shows only unarchived, completed todos
- [ ] Archived view shows only archived todos

### Import/Export
- [ ] Export creates valid JSON file
- [ ] Import validates JSON structure
- [ ] Import validates todo fields
- [ ] Import updates existing todos by ID
- [ ] Import adds new todos
- [ ] Import clears existing data first
- [ ] Error handling for invalid JSON
- [ ] Error handling for validation failures

### Cross-Tab Sync
- [ ] Open app in two tabs
- [ ] Add todo in tab 1 → appears in tab 2 automatically
- [ ] Update todo in tab 1 → updates in tab 2 automatically
- [ ] Delete todo in tab 1 → removes from tab 2 automatically
- [ ] Changes sync within 1-2 seconds

### Edge Cases
- [ ] Empty todo list displays correctly
- [ ] Very long todo labels handled properly
- [ ] Special characters in todo labels work
- [ ] Week number edge cases (week 1, week 52/53)
- [ ] Large number of todos (approaching 1000) still performant
- [ ] Browser storage quota warnings (if implementing)

## Risk Mitigation

### Data Loss
- **Risk**: All existing IndexedDB data will be lost
- **Mitigation**: 
  - Acceptable per requirements
  - Consider adding export feature before migration for backup
  - Users can re-import after migration

### Storage Limits
- **Risk**: Approaching 5-10MB LocalStorage limit
- **Mitigation**:
  - Monitor with < 1000 todos (should be ~500KB-1MB)
  - Add warning when storage is 80% full
  - Consider compression for larger datasets

### Performance
- **Risk**: Synchronous JSON operations blocking UI
- **Mitigation**:
  - Not expected with < 1000 todos
  - Test with maximum expected dataset
  - Consider chunked operations if needed

### Rollback Plan
1. Keep git branch with Dexie version until verified
2. Both implementations can't coexist (different storage mechanisms)
3. If critical issues found, revert to Dexie branch
4. Re-migration would require re-importing data

## Timeline

**Total: 1-2 days**

### Day 1
- **Morning (3-4 hours)**: Phases 1-3
  - Dependencies installation
  - Collection creation
  - Composables migration
- **Afternoon (3-4 hours)**: Phase 4
  - Store migration
  - Live query implementation

### Day 2
- **Morning (2-3 hours)**: Phases 5-6
  - Import/export migration
  - Cleanup
  - Initial testing
- **Afternoon (3-4 hours)**: Testing & Polish
  - Full testing checklist
  - Bug fixes
  - Performance validation
  - Cross-tab sync testing

## Files Modified Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `package.json` | Modify | Add @tanstack/vue-db, remove dexie, keep valibot |
| `src/db/collections.ts` | Create | New TanStack DB collection with valibot schema |
| `src/db/db.ts` | Delete | Remove Dexie database |
| `src/types/todo.ts` | Modify | Remove interface, use inferred type from valibot schema |
| `src/composables/useTodos.ts` | Modify | Update to use collection |
| `src/composables/useDataExport.ts` | Modify | Update import/export with valibot validation |
| `src/stores/todos.ts` | Modify | Replace with live queries |
| `src/components/*.vue` | Modify | Update to use valibot validation for labels |
| `AGENTS.md` | Modify | Update tech stack and database guidelines |

### Documentation Update Required

**File**: `AGENTS.md`

After migration, update the following sections:

1. **Tech Stack** - Update Database line:
   ```
   - **Database**: TanStack DB (LocalStorage) with valibot schema validation
   ```

2. **Database Guidelines** - Replace entire section with:
   - Use TanStack DB `createCollection()` with `localStorageCollectionOptions`
   - Define schemas using valibot for runtime validation
   - Use `crypto.randomUUID()` for unique IDs
   - Always set `updatedAt` timestamp on modifications
   - Collection methods: `insert()`, `update()`, `delete()` (synchronous)
   - Live queries via `useLiveQuery()` hook
   - Cross-tab sync enabled by default

3. **Reactivity Pattern** - Update to reflect TanStack DB:
   - TanStack DB live queries provide automatic reactivity
   - No manual state updates needed after mutations
   - Components subscribe to live queries for real-time updates

4. **Imports** - Remove Dexie-specific import guidelines

5. **Remove references to**:
   - Dexie.js
   - IndexedDB
   - `Table` type from dexie
   - `db.todos` pattern

## Post-Migration Verification

After migration is complete, verify:

1. **Bundle size**: Check that removing Dexie reduces bundle size
2. **Performance**: Measure query/filter performance vs before
3. **Memory usage**: Monitor memory usage with large todo lists
4. **User experience**: Test on slow devices/networks
5. **Cross-browser**: Test in Chrome, Firefox, Safari, Edge

### Update Documentation

**CRITICAL**: Update `AGENTS.md` to reflect new architecture:
- [ ] Update Tech Stack section (replace Dexie with TanStack DB)
- [ ] Update Database Guidelines section (new patterns)
- [ ] Update Reactivity Pattern section (live queries)
- [ ] Remove Dexie-specific import guidelines
- [ ] Update any code examples referencing Dexie

## Additional Considerations

### Future Enhancements
With TanStack DB, you can easily add:
- Server sync (using Query Collection with ElectricSQL/RxDB)
- Offline support
- Real-time collaboration
- Optimistic mutations with server reconciliation

### Monitoring
Consider adding:
- Storage usage tracking
- Performance metrics
- Error tracking for mutations

## Conclusion

This migration provides:
- ✅ Simpler codebase (no Dexie dependency)
- ✅ Better reactivity (live queries)
- ✅ Cross-tab synchronization
- ✅ Runtime validation with valibot schemas
- ✅ Type safety from single source of truth (schema → type)
- ✅ Future-proof for server sync
- ✅ Acceptable for < 1000 todos

**Key Improvements**:
1. **Valibot Integration**: Runtime validation on all data operations
2. **Standard Schema v1**: Compatible with TanStack ecosystem
3. **Validation Rules**: Enforced 1-500 char labels, valid characters only
4. **Type Safety**: Types inferred from valibot schemas
5. **Better DX**: Clear validation error messages

**Next Step**: Execute this plan in a new session.

---

**Document Version**: 1.0  
**Created**: 2026-02-01  
**Status**: Ready for Execution
