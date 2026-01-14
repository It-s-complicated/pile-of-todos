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
- **State Management**: Pinia 3.0+ with setup store syntax
- **Routing**: Vue Router 4.6+
- **Database**: Dexie.js 4.2+ (IndexedDB wrapper)
- **Styling**: Tailwind CSS 4.1+ with Vite plugin
- **PWA**: vite-plugin-pwa 1.2+
- **TypeScript**: 5.9+ with strict mode enabled

## Code Style Guidelines

### File Structure
```
src/
├── components/     - Reusable Vue components (PascalCase.vue)
├── composables/    - Vue composition functions (useXxx.ts)
├── stores/         - Pinia stores (xxx.ts)
├── types/          - TypeScript type definitions
├── db/             - Database setup
├── router/         - Vue Router configuration
├── views/          - Page-level components (PascalCaseView.vue)
├── App.vue         - Root component
├── main.ts         - Application entry point
└── style.css       - Tailwind CSS import and theme
```

### Naming Conventions
- **Components/Views**: PascalCase (`TodoItem.vue`, `BacklogView.vue`)
- **Composables**: camelCase with `use` prefix (`useTodos.ts`, `useWeekNumber.ts`)
- **Stores**: camelCase with `use` prefix (`useTodosStore`)
- **Types/Interfaces**: PascalCase (`Todo`, `TodoFilter`)
- **Functions/Variables**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE (rare)

### TypeScript Guidelines
- Strict mode enabled in tsconfig - all types must be explicit
- Use `type` keyword for type-only imports: `import type { Todo } from './types/todo'`
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

### Pinia Store Guidelines
- Use setup store syntax: `defineStore('name', () => { ... })`
- State with `ref<T>()` and `computed<T>()`
- Actions update local state immediately for reactivity
- Import database composables with renamed exports to avoid conflicts:
  ```ts
  const { addTodo: addTodoDB, updateTodo: updateTodoDB } = useTodosDB()
  ```

### Database Guidelines
- Use Dexie.js for IndexedDB operations
- Table indexes defined in db.ts: `'id, weekNumber, done, archived, createdAt, updatedAt'`
- All DB operations return Promises
- Use `crypto.randomUUID()` for unique IDs (cloud-sync ready)
- Always set `updatedAt` timestamp on modifications
- Initial objects include: `id, label, weekNumber, done, archived, createdAt, updatedAt`

### Data Export/Import Guidelines
- Export composable: `useDataExport()` provides `exportTodos()` and `importTodos()` functions
- Export format: JSON with `version`, `exportedAt`, and `todos` array
- Import validates JSON structure and todo fields before insertion
- Import uses upsert logic: updates existing todos by ID, adds new ones
- After successful import, call `loadTodos()` to refresh store state
- Export filename format: `todo-export-YYYY-MM-DD.json`

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
- Absolute imports use `@/` alias: `import { X } from '@/types/todo'`
- Relative imports for sibling files: `import { X } from '../types/todo'`
- Type imports explicitly marked: `import type { Table } from 'dexie'`
- Value imports without type keyword: `import Dexie from 'dexie'`

### Reactivity Pattern
- State management: Store actions update local state, then persist to DB
- Example pattern:
  ```ts
  async function addTodo(...) {
    const id = await db.addTodo(...)
    localState.value.push(newItem)  // Immediate UI update
  }
  ```
- This ensures UI updates immediately without page reload

### Router Guidelines
- Route names match view names: `'backlog'`, `'current-week'`, etc.
- Use route-based filtering in store: `route.name as TodoFilter`
- Router links: `<RouterLink to="/path" class="...">Link</RouterLink>`

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
