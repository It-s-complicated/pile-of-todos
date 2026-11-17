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

Lane filtering and sorting live in `src/lib/lanes.ts` (`filterLane`), exposed to views through `useLane(laneId)`. `currentWeek` comes from `useCurrentWeek()`, which updates when the ISO week changes while the app is open.

- **backlog**: `weekNumber === null && !archived`
- **current**: `weekNumber === currentWeek && !archived` (open tasks first)
- **future**: `weekNumber > currentWeek && !archived`, grouped by week
- **unfinished**: `weekNumber < currentWeek && !done && !archived`, grouped by week
- **finished**: `done === true && !archived`, most recently updated first
- **archived**: `archived === true`

## Weeks

- `weekNumber` holds a year-aware ISO week key `YYYYWW` (e.g. `202646`). Use the helpers in `src/lib/weeks.ts`; never do arithmetic on the key directly (use `addWeeks`).
- Legacy rows stored only `1`–`53`; `normalizeWeekKey()` upgrades them in the read-model overlay and on import.

## Task actions

- Use `useTodoActions()` for complete / move / archive / rename from the UI. It shows an undo toast and the undo only restores the fields the action changed.
