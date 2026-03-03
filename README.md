# AI Todo App

A weekly planning todo app built with Vue 3, TanStack DB, and Tailwind CSS. The app is local-first by default (LocalStorage-backed) and can optionally sync to cloud storage through Supabase + Electric connectivity when those environment variables are configured.

## What it does

- Capture tasks into a backlog or assign them to upcoming week numbers.
- Navigate focused list views: Backlog, Current Week, Future, Unfinished, Finished, and Archived.
- Work fully offline with local persistence.
- Export/import your todo dataset as JSON.
- Optionally sync local changes to a shared cloud dataset when online.

## Environment variables

Create `.env.local` for frontend variables and (if using Drizzle migration/push tooling) provide `DATABASE_URL` in your shell environment or `.env.local`.

### Frontend (Vite) variables

| Variable | Required | Purpose | Behavior when missing |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional (required for cloud sync) | Supabase project URL used by the client. | App still works locally; cloud sync is disabled and status becomes **Local only**. |
| `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_KEY`) | Optional (required for cloud sync) | Supabase API key used for read/write sync calls. | Same as above: offline/local mode continues, remote sync/migration is unavailable. |
| `VITE_ELECTRIC_SHAPE_URL` | Optional | Direct Electric shape endpoint URL. | Falls back to `VITE_API_BASE_URL + /v1/shape`; no user-facing break for local mode. |
| `VITE_API_BASE_URL` | Optional | Base URL used to derive Electric shape URL when explicit shape URL is not set. | Defaults to `http://localhost:30000`; local-only todo behavior still works. |
| `VITE_ELECTRIC_SOURCE_ID` | Optional | Electric Cloud source identifier, appended as shape query param. | Shape URL omits source auth params. |
| `VITE_ELECTRIC_SECRET` | Optional | Electric Cloud secret, appended as shape query param. | Shape URL omits source auth params. |
| `VITE_DEVICE_ID` | Optional | Stable device identifier attached to todo writes. | Runtime-generated `device-xxxxxxxx` value is used. |
| `VITE_ELECTRIC_PROXY_URL` | Optional | Reserved env key in typings for Electric proxy-based setups. | Not used by current app code; no behavior change. |

### Backend/tooling variable

| Variable | Required | Purpose | Behavior when missing |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required for Drizzle commands (`migrate`, `db:push`, `db:studio`, etc.) | PostgreSQL connection string for schema management tooling. | Drizzle commands fail at startup. Frontend app runtime is unaffected. |

## Scripts

From `package.json`:

- `npm run dev` — start Vite dev server.
- `npm run build` — type-check with `vue-tsc -b` and create a production build.
- `npm run preview` — preview the production build locally.
- `npm run lint` — run Oxlint.
- `npm run lint:fix` — run Oxlint with autofix.
- `npm run fmt` / `npm run fmt:check` — format or check formatting with OXC formatter.

Type-check only (without building):

- `npx vue-tsc --noEmit`

## Architecture overview

### `src/db`

- `collections.ts`
  - Defines the todo schema and collection models.
  - Uses LocalStorage as the source of truth for reads/writes (`localTodosCollection`).
  - Includes Electric collection wiring and Supabase mutation handlers for cloud-backed operations.
  - Exposes helpers like `isElectricConfigured()`, `getActiveCollection()`, and device-id helpers.
- `schema.ts`
  - Drizzle Postgres table definition and validation schemas for `todos`.
- `connection.ts`
  - Node-side Drizzle connection helper for migration/database tooling.

### `src/composables`

- `useElectricTodos.ts`
  - Main todo state + mutation API for UI.
  - Manages online/offline status and sync lifecycle (`synced`, `syncing`, `error`, `local-only`).
  - Reconciles local and remote data when sync is enabled.
- `useTodos.ts`
  - Filtered todo querying by route category and current week semantics.
- `useDataExport.ts`
  - Export/import JSON with validation.
- `useNetworkStatus.ts`
  - Reactive online/offline browser connectivity tracking.
- `useWeekNumber.ts`
  - Week-number utility logic for planning buckets.
- `useMigration.ts`, `useCloudSync.ts`
  - Supporting sync abstractions.

### `src/components`

- `TodoList.vue` and `TodoItem.vue`
  - Core list rendering + item-level interactions (toggle, edit, archive, delete).
- `WeekSelector.vue`
  - Week assignment UI helper.
- `SyncStatus.vue`
  - Header indicator for connectivity/sync state and retry affordance on sync errors.

### Routing and views

- `src/router/index.ts` defines route-based list categories:
  - `/backlog`
  - `/current-week`
  - `/future`
  - `/unfinished`
  - `/finished`
  - `/archived`
- Each `src/views/*View.vue` provides section framing text and renders the shared `TodoList` component.
- `App.vue` hosts global layout, new task form, navigation pills, sync status, and data import/export controls.

## Data import/export behavior

- Export creates a JSON payload containing:
  - `version`
  - `exportedAt`
  - `todos`
- Import validates the file structure and todo payload with Valibot before applying any changes.
- **Overwrite semantics:** import is destructive for the active collection.
  - Existing todos are deleted first.
  - Imported todos are then inserted in bulk.
- Import/export targets the currently active collection provider selected by app state (local-first behavior today).

## Troubleshooting

### Offline mode expectations

- If the browser goes offline, the app remains usable because todos are stored locally.
- Sync indicator shows **Offline** while disconnected.
- Changes made offline remain local and can be synchronized once connectivity is restored (when sync is configured).

### Sync status meanings

- **Synced**: local and remote reconciliation completed successfully.
- **Syncing...**: migration/reconciliation is in progress.
- **Sync error**: a cloud operation failed; use **Retry sync** after checking credentials/connectivity.
- **Local only**: cloud sync is unavailable (either offline or missing Supabase config).

### Common fixes

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` if sync never leaves **Local only**.
- Confirm your Supabase table/schema matches expected `todos` columns.
- If Drizzle tooling fails, set `DATABASE_URL` before running migration or studio commands.
