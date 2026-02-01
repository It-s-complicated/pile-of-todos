# AGENTS.md

## Build Commands

### Essential Commands
- `npm run dev` - Start Vite development server (http://localhost:5173)
- `npm run build` - Run TypeScript type check and build for production
- `npm run preview` - Preview production build locally
- `npx vue-tsc --noEmit` - Run TypeScript type checking without emitting files

### Type Checking
Always run `npx vue-tsc --noEmit` after changes to verify type safety before building.

## Tech Stack

- **Framework**: Vue 3.5+ with Composition API and `<script setup lang="ts">`
- **Build Tool**: Vite 7.2+
- **Routing**: Vue Router 5.0+
- **Database**: TanStack DB (LocalStorage) with valibot schema validation
- **Styling**: Tailwind CSS 4.1+ with Vite plugin
- **PWA**: vite-plugin-pwa 1.2+
- **Validation**: valibot (data validation for import/export)
- **TypeScript**: 5.9+ with strict mode enabled

## Code Style Guidelines

### File Structure
```
src/
├── components/     - Reusable Vue components (PascalCase.vue)
├── composables/    - Vue composition functions (useXxx.ts)
├── db/             - Database setup and collections
├── router/         - Vue Router configuration
├── views/          - Page-level components (PascalCaseView.vue)
├── App.vue         - Root component
├── main.ts         - Application entry point
├── env.d.ts        - Vue type declarations
└── style.css       - Tailwind CSS import and theme
```

### Naming Conventions
- **Components/Views**: PascalCase (`TodoItem.vue`, `BacklogView.vue`)
- **Composables**: camelCase with `use` prefix (`useWeekNumber.ts`, `useDataExport.ts`)
- **Types/Interfaces**: PascalCase (`Todo`, `TodoFilter`)
- **Functions/Variables**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE (rare)

### TypeScript Guidelines
- Strict mode enabled in tsconfig - all types must be explicit
- Use `type` keyword for type-only imports: `import type { Todo } from './db/collections'`
- No `any` types - use `unknown` with type guards if necessary
- Use `Partial<T>` for update operations
- Prefer explicit return types on exported functions
- Define props with `defineProps<{ prop: Type }>()` syntax

### Vue Component Guidelines
- Use `<script setup lang="ts">` in all .vue files
- Define emits: `defineEmits<{ eventName: [param: Type] }>()` or array for simple events
- Define props: `defineProps<{ prop: Type }>()`
- Use Tailwind utility classes for ALL styling - no scoped CSS
- Import types with `import type { X }` to avoid verbatimModuleSyntax conflicts

### Database Guidelines
- Use TanStack DB `createCollection()` with `localStorageCollectionOptions`
- Define schemas using valibot for runtime validation
- Use `crypto.randomUUID()` for unique IDs (cloud-sync ready)
- Always set `updatedAt` timestamp on modifications
- Collection methods: `insert()`, `update()`, `delete()` (synchronous)
- Live queries via `useLiveQuery()` hook
- Cross-tab sync enabled by default
- Collection file: `src/db/collections.ts` defines `todosCollection` and schemas

### Data Export/Import Guidelines
- Export composable: `useDataExport()` provides `exportTodos()` and `importTodos()` functions
- Export format: JSON with `version`, `exportedAt`, and `todos` array
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
- Export filename format: `todo-export-YYYY-MM-DD.json`
- Import returns `{ success: boolean; message: string; count?: number }` result object
- Validation errors include path and message for easy debugging

### UI Feedback Patterns
- Display success/error messages for user actions (import/export operations)
- Use conditional styling for feedback: `bg-green-100 text-green-800` for success, `bg-red-100 text-red-800` for errors
- Auto-dismiss messages with `setTimeout()` (typical: 5000ms)
- Use hidden file input for import: `class="hidden"` with trigger button
- Clear file input value after processing: `target.value = ''`

### Validation Guidelines
- Todo labels validated using **valibot** schemas
- Label validation rules:
  - Minimum length: 1 character (cannot be empty)
  - Maximum length: 500 characters
  - Allowed characters: letters, numbers, spaces, and `-.,!?@+#$%&*'()`
- Validation errors shown as red messages that auto-dismiss after 5000ms
- Validation prevents invalid data from being added to database
- Validation schema example:
  ```ts
  import { maxLength, minLength, pipe, regex, string } from 'valibot'

  const TodoLabelSchema = pipe(
    string(),
    minLength(1, 'Label cannot be empty'),
    maxLength(500, 'Label must be less than 500 characters'),
    regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
  )
  ```

### Styling Guidelines
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Use `@theme` directive in style.css for custom colors
- All styling via utility classes in templates
- Common classes: `bg-blue-500`, `text-gray-700`, `rounded-md`, `px-4 py-2`
- No CSS files in components directory

### Error Handling
- Use optional chaining and null checks: `todo?.label`
- Early returns for error conditions
- Check array indices before access: `if (index !== -1)`
- Async functions should handle promise rejections (await without try/catch is OK in UI code)

### Imports
- Absolute imports use `@/` alias: `import { X } from '@/db/collections'`
- Relative imports for sibling files: `import { X } from '../db/collections'`

### Reactivity Pattern
- TanStack DB live queries provide automatic reactivity
- No manual state updates needed after mutations
- Components subscribe to live queries for real-time updates
- Use `useLiveQuery()` with filter conditions for different views

### Router Guidelines
- Route names match view names: `'backlog'`, `'current-week'`, `'future'`, `'unfinished'`, `'finished'`, `'archived'`
- Use route-based filtering in store: `route.name as TodoFilter`
- Router links: `<RouterLink to="/path" class="...">Link</RouterLink>`
- All views except 'archived' filter out archived todos (`!t.archived`)

### View Filtering Behavior
- **backlog**: `weekNumber === null && !archived`
- **current-week**: `weekNumber === currentWeek && !archived`
- **future**: `weekNumber > currentWeek && !archived`
- **unfinished**: `weekNumber < currentWeek && !done && !archived`
- **finished**: `done === true && !archived`
- **archived**: `archived === true` (shows all archived todos)

### PWA Configuration
- Manifest in vite.config.ts (not separate file)
- Icons: 192x192 and 512x512 PNG in public/
- Service worker auto-update enabled

## Testing

No test framework is currently configured. When adding tests:
- Use Vitest for unit testing
- Use @vue/test-utils for component testing
- Tests in `tests/` directory
- Run single test: `npm test -- path/to/test.spec.ts`
