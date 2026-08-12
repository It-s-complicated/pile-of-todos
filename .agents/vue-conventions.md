# Vue Conventions

## Components

- Use `<script setup lang="ts">` in all .vue files
- Define emits: `defineEmits<{ eventName: [param: Type] }>()` or array for simple events
- Define props: `defineProps<{ prop: Type }>()`
- Import types with `import type { X }` to avoid verbatimModuleSyntax conflicts

## Naming

- **Components/Views**: PascalCase (`TodoItem.vue`, `BacklogView.vue`)
- **Composables**: camelCase with `use` prefix (`useTodos.ts`, `useDataExport.ts`)

## Reactivity

- TanStack DB live queries provide automatic reactivity
- No manual state updates needed after mutations
- Components subscribe to live queries for real-time updates
- Use `useLiveQuery()` with filter conditions for different views

## Router

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
