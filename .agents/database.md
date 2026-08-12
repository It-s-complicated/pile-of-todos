# Database Guidelines

## Collection Setup

- `src/db/confirmed-todos.ts` owns the Supabase-backed confirmed-read collection.
- Keep the collection transport schema in snake_case and map rows to the shared `Todo` domain type in one place.
- Do not call the collection's direct mutation methods; writes must use `apply_todo_mutation` so idempotency and soft deletes stay intact.
- The durable browser mutation queue is user-partitioned in localStorage.

## Schema Design

- Define schemas using valibot for runtime validation
- Use `crypto.randomUUID()` for unique IDs (cloud-sync ready)
- Always set `updatedAt` timestamp on modifications

## CRUD Operations

- Queue optimistic mutations through `useTodoMutations()`.
- Live confirmed reads use `useLiveQuery()` and Supabase RLS.

## Data Import/Export

### Export

- Export composable: `useDataExport()` provides `exportTodos()` and `importTodos()` functions
- Export format: JSON with `version`, `exportedAt`, and `todos` array
- Export filename format: `todo-export-YYYY-MM-DD.json`

### Import

- Import validates JSON structure and todo fields using **valibot** schemas
- Import validation schemas:

```ts
const TodoSchema = object({
  id: string(),
  label: string(),
  weekNumber: any(),
  done: boolean(),
  archived: boolean(),
  createdAt: number(),
  updatedAt: number(),
})

const ExportDataSchema = object({
  version: string(),
  exportedAt: string(),
  todos: array(TodoSchema),
})
```

- Import uses upsert logic: updates existing todos by ID, adds new ones
- After successful import, call `loadTodos()` to refresh store state
- Import returns `{ success: boolean; message: string; count?: number }` result object
- Validation errors include path and message for easy debugging
