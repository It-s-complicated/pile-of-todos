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

| Variable                           | Required                           | Purpose                                                                        | Behavior when missing                                                               |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                | Optional (required for cloud sync) | Supabase project URL used by the client.                                       | App still works locally; cloud sync is disabled and status becomes **Local only**.  |
| `VITE_SUPABASE_ANON_KEY`           | Optional (required for cloud sync) | Supabase anon/publishable key used for authenticated read/write sync calls.    | Same as above: offline/local mode continues, remote sync/migration is unavailable.  |
| `VITE_ELECTRIC_SHAPE_URL`          | Optional                           | Direct Electric shape endpoint URL.                                            | Falls back to `VITE_API_BASE_URL + /v1/shape`; no user-facing break for local mode. |
| `VITE_API_BASE_URL`                | Optional                           | Base URL used to derive Electric shape URL when explicit shape URL is not set. | Defaults to `http://localhost:30000`; local-only todo behavior still works.         |
| `VITE_ELECTRIC_SOURCE_ID`          | Optional                           | Electric Cloud source identifier, appended as shape query param.               | Shape URL omits source auth params.                                                 |
| `VITE_ELECTRIC_SECRET`             | Optional                           | Electric Cloud secret, appended as shape query param.                          | Shape URL omits source auth params.                                                 |
| `VITE_DEVICE_ID`                   | Optional                           | Stable device identifier attached to todo writes.                              | Runtime-generated `device-xxxxxxxx` value is used.                                  |
| `VITE_ELECTRIC_PROXY_URL`          | Optional                           | Reserved env key in typings for Electric proxy-based setups.                   | Not used by current app code; no behavior change.                                   |
| `VITE_APPROVED_GITHUB_PROVIDER_ID` | Optional                           | Approved GitHub `provider_id` used by the UI to explain allowlist denials.     | Supabase-side hook remains the source of truth; UI diagnostics are less specific.   |

### Backend/tooling variable

| Variable       | Required                                                                | Purpose                                                     | Behavior when missing                                                 |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL` | Required for Drizzle commands (`migrate`, `db:push`, `db:studio`, etc.) | PostgreSQL connection string for schema management tooling. | Drizzle commands fail at startup. Frontend app runtime is unaffected. |

## Auth and backend architecture note

- Current app is frontend-only; auth is handled by Supabase Auth.
- If migrating to better-auth later, add a backend service first.
- If/when a backend is introduced, re-evaluate replacing Supabase auth flows with better-auth in that backend layer.

### Supabase Auth integration checklist

To integrate Supabase authentication correctly in this frontend-only app:

1. Create a Supabase project and enable the authentication providers you plan to support (for example email/password or OAuth).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` so the client can initialize Supabase.
3. Configure **Auth > URL Configuration** in Supabase:
   - Set the site URL for your environment (dev/prod).
   - Add all allowed redirect URLs used by your app.
4. Ensure the `todos` table policies are compatible with authenticated access (RLS + policies that match your auth model) before enabling shared cloud usage.
5. Verify session behavior in the browser:
   - Sign in/out flows complete successfully.
   - Refreshing the page restores the user session.
   - Sync status transitions out of **Local only** only when config, connectivity, and an authenticated session are all present.
   - Todos created while signed out remain local-only until you explicitly claim or migrate them.
6. Keep using Supabase Auth in the frontend until a backend exists; do not add better-auth client/server packages at this stage.

## GitHub auth single-user sync

The app now keeps two local todo buckets:

- guest todos in `ai-todo-app-todos-guest`
- one account-local bucket per Supabase user id in `ai-todo-app-todos-user:<user-id>`

Authenticated sync runs only for the approved GitHub account bucket. Guest todos stay local until the signed-in user either claims them into the account bucket or keeps them separate.

### Supabase setup

1. Enable the GitHub provider in Supabase Auth and add your local/prod redirect URLs.
2. Apply [`src/db/out/0003_github_auth_allowlist.sql`](src/db/out/0003_github_auth_allowlist.sql).
3. Replace the placeholder `REPLACE_WITH_APPROVED_GITHUB_PROVIDER_ID` row in `public.github_auth_allowlist` with the single approved GitHub `provider_id`.
4. Register the `before-user-created` hook with the Postgres function URI:
   `pg-functions://postgres/public/hook_allow_single_github_identity`
5. Optionally set `VITE_APPROVED_GITHUB_PROVIDER_ID` in `.env.local` so the UI can explain denials using the same provider id.

### How to obtain the approved GitHub provider_id

- Complete one allowed GitHub sign-in in a safe environment, then inspect `auth.users.raw_app_meta_data`, `auth.identities`, or the hook payload for the GitHub identity.
- Use the GitHub identity `provider_id` as the row stored in `public.github_auth_allowlist`.
- The database allowlist is the source of truth; the frontend env var is diagnostic only.

### Guest claim flow

- While signed out, new todos and imports go to the guest bucket and keep `userId = null`.
- After the approved user signs in, the app pauses sync if guest todos exist and shows a one-time claim prompt.
- Accepting the prompt rewrites guest rows to the current authenticated `userId`, moves them into the account bucket, and starts sync automatically.
- Declining leaves the guest bucket intact and starts sync against the signed-in account bucket only.
- Signing out returns the UI to the guest bucket without deleting the account-local cache.

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
- **Local only** also covers signed-out sessions: authenticated sync is intentionally disabled until a Supabase user session exists.

### Common fixes

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` if sync never leaves **Local only**.
- Confirm you are signed in before expecting remote sync; the app no longer falls back to unauthenticated writes.
- If GitHub sign-in redirects back with an auth error, verify the approved `provider_id` seed row and the registered auth hook function.
- Confirm your Supabase table/schema matches expected `todos` columns.
- If Drizzle tooling fails, set `DATABASE_URL` before running migration or studio commands.

## Supabase write hardening

- `todos.user_id` is now the ownership column used by both RLS policies and Electric read scoping.
- The browser client accepts only `VITE_SUPABASE_ANON_KEY`; `VITE_SUPABASE_KEY` is no longer recognized.
- Remote sync writes run only for the authenticated owner, and Electric reads are filtered to that same `user_id`.
- Existing hosted rows with `NULL user_id` must be backfilled to a real Supabase auth user before a follow-up migration can safely mark `user_id` as `NOT NULL`.
