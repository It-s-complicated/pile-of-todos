# Pile of Todos

A weekly planning todo app built with Vue 3, TanStack DB, and Tailwind CSS.

The runtime architecture is explicitly browser-driven:

- Supabase handles browser auth, confirmed reads, Realtime, and RPC writes.
- TanStack DB provides the live confirmed-read collection and optimistic overlay.
- This app does **not** include an app-owned server runtime, proxy, or `/api/*` routes.

## What it does

- Capture tasks into a backlog or assign them to upcoming week numbers.
- Navigate focused list views: Backlog, Current Week, Future, Unfinished, Finished, and Archived.
- Keep working offline with queued mutations that sync later.
- Import todo JSON into the same durable queued-mutation flow used by normal todo creation.
- Sync the signed-in account against the shared cloud dataset when available.

## Environment variables

Create `.env.local` for browser runtime variables. The app does not use an `API_BASE_URL` for app-owned `/api/*` routes. If you use Drizzle migration tooling, also provide `DATABASE_URL` in your shell environment or `.env.local`.

### Frontend (Vite) variables

| Variable                 | Required | Purpose                                                       |
| ------------------------ | -------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Yes      | Supabase project URL used by the browser.                     |
| `VITE_SUPABASE_ANON_KEY` | Yes      | Supabase publishable/anon key used by the browser client.     |
| `VITE_DEVICE_ID`         | Yes      | Stable device identifier attached to client mutation intents. |

The frontend runtime contract intentionally does **not** include an app-owned API base URL or server secret. Supabase RLS scopes browser reads, and all writes use `apply_todo_mutation`.

### Backend/tooling variable

| Variable       | Required                                                                   | Purpose                                                     | Behavior when missing                                                 |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL` | Required for Drizzle commands (`migrate`, `migrate:generate`, `db:studio`) | PostgreSQL connection string for schema management tooling. | Drizzle commands fail at startup. Frontend app runtime is unaffected. |

## Auth and backend architecture note

- Current app is frontend-only; Supabase Auth handles authentication and Supabase database functions/tables handle browser writes.
- `@supabase-labs/tanstack-db` supplies confirmed, auth-scoped todo reads through PostgREST and Realtime.
- No app-owned server runtime, proxy, or `/api/*` routes are present in this app.
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
   - Signed-in sessions can queue mutations offline and sync them after connectivity returns.
   - Signed-out sessions cannot create or sync todos until authentication is restored.
6. Keep using Supabase Auth in the frontend until a backend exists; do not add better-auth client/server packages at this stage.

## Sync architecture summary

- Browser auth: Supabase Auth
- Browser write path: Supabase `apply_todo_mutation` RPC calls from the client
- Browser read path: Supabase PostgREST + Realtime through TanStack DB
- App-owned server runtime: none
- App-owned `/api/*` routes: none

## GitHub auth single-user sync

Authenticated sync runs only for the allowed GitHub-backed account. Browser runtime auth authority comes from the active Supabase session, while account admission remains enforced by the Supabase auth hook and database-side allowlist.

### Supabase setup

1. Enable the GitHub provider in Supabase Auth and add your local/prod redirect URLs.
2. Apply [`src/db/out/0003_github_auth_allowlist.sql`](src/db/out/0003_github_auth_allowlist.sql).
3. Replace the placeholder `REPLACE_WITH_APPROVED_GITHUB_PROVIDER_ID` row in `public.github_auth_allowlist` with the single approved GitHub `provider_id`.
4. Register the `before-user-created` hook with the Postgres function URI:
   `pg-functions://postgres/public/hook_allow_single_github_identity`

### How to obtain the approved GitHub provider_id

- Complete one allowed GitHub sign-in in a safe environment, then inspect `auth.users.raw_app_meta_data`, `auth.identities`, or the hook payload for the GitHub identity.
- Use the GitHub identity `provider_id` as the row stored in `public.github_auth_allowlist`.
- The database allowlist is the source of truth for admission control.

## Scripts

Use Vite+ commands:

- `vp dev` — start the Vite dev server.
- `vp check` — run formatting, lint, and type checks.
- `vp test` — run the test suite.
- `vp build` — produce the production build.
- `vp preview` — preview the production build locally.
- `pnpm migrate:generate` — generate a reviewed migration after a schema change.
- `pnpm migrate` — apply committed migrations. Do not use `drizzle-kit push`.

## Architecture overview

### `src/db`

- `collections.ts`
  - Defines the Valibot todo schema and todo type.
  - Exposes the device-id helper used by queued mutation intents.
- `confirmed-todos.ts`
  - Creates the Supabase-backed TanStack DB collection for confirmed todo reads.
  - Defines the snake_case PostgREST row schema, domain mapper, Realtime subscription, and snapshot refresh helper.
- `schema.ts`
  - Drizzle Postgres table definition and validation schemas for `todos`.
- `connection.ts`
  - Node-side Drizzle connection helper for migration/database tooling.

### `src/composables`

- `useTodos.ts`
  - Main public todo API used by the UI.
  - Combines read state, mutation methods, connectivity, queue counts, and sync/degraded statuses.
- `useTodoData.ts`
  - Shared singleton wiring for auth state, network state, read model readiness, and the mutation queue controller.
- `useTodoReadModel.ts`
  - Reads the authenticated Supabase snapshot and overlays pending queued mutations for optimistic UI.
- `useTodoMutations.ts`
  - Builds optimistic create/update/delete mutation intents and puts them on the durable queue.
- `useTodoSync.ts`
  - Derives user-facing sync/degraded status from the mutation queue controller.
- `useTodoCreateQueueController.ts`
  - Durable local mutation queue controller.
  - Persists queued mutations, flushes them to the Supabase RPC, and removes accepted overlays only after a successful confirmed snapshot refresh.
- `useDataExport.ts`
  - Programmatic export/import JSON helper.
  - Import validates individual todos before queueing create mutations.
- `useNetworkStatus.ts`
  - Reactive online/offline browser connectivity tracking.

### `src/components`

- `TodoList.vue` and `TodoItem.vue`
  - Core list rendering + item-level interactions (toggle, edit, archive, delete).
- `WeekSelector.vue`
  - Week assignment UI helper.
- `SyncStatus.vue`
  - Header indicator for connectivity/sync state and retry affordance on sync errors.

### Routing and pages

- `src/router/index.ts` uses `vue-router/auto-routes` to load page routes from `src/pages`.
- `src/pages/index.vue` redirects to `/backlog`.
- The page files define route-based list categories:
  - `/backlog`
  - `/current`
  - `/future`
  - `/unfinished`
  - `/finished`
  - `/archived`
- Each `src/pages/*.vue` page filters the shared todo read model and renders `TodoList` with its empty state.
- `App.vue` hosts global layout, new task form, navigation pills, and sync status.

## Data import/export behavior

- Export creates a JSON payload containing `todos`.
- Export serializes the current visible merged todo set when invoked programmatically; export is not currently exposed in the visible UI.
- Import accepts either a top-level todo array or an object with a `todos` array, then validates each todo with Valibot before queueing any changes.
- **Import semantics:** imported todos use the same durable local mutation queue as manually created todos, so they appear immediately and remain pending until the post-write Supabase snapshot refresh succeeds.

## Troubleshooting

### Offline mode expectations

- Signed-in sessions remain usable offline because pending mutations are stored locally and retried later.
- Signed-out sessions do not create or sync todos until authentication is restored.
- While transport prerequisites are unavailable (for example offline or signed out), the sync indicator shows **Paused**.

### Sync status meanings

- **Re-auth required**: pending work is blocked until the signed-in account refreshes its Supabase session.
- **Retry pending**: at least one queued mutation failed retryably; use **Retry sync** when available.
- **Syncing...**: queued work is actively flushing.
- **Awaiting confirmation**: Supabase accepted the mutation, and its optimistic overlay is waiting for a successful authoritative snapshot refresh.
- **Paused**: sync transport is unavailable or intentionally blocked, including offline, signed-out, or not-ready states.
- **Synced**: no degraded state or active sync delivery is pending.

### Common fixes

- If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing in `.env.local`, the app fails at startup with a configuration error instead of showing **Paused**.
- Confirm you are signed in with the allowed account before expecting create or remote sync; the app no longer falls back to unauthenticated writes.
- If GitHub sign-in redirects back with an auth error, verify the approved `provider_id` seed row and the registered auth hook function.
- Confirm your Supabase table/schema matches expected `todos` columns.
- If Drizzle tooling fails, set `DATABASE_URL` before running migration or studio commands.

## Supabase write hardening

- `todos.user_id` is the ownership column used by RLS and the live-query scope.
- The browser client accepts only `VITE_SUPABASE_ANON_KEY`; `VITE_SUPABASE_KEY` is no longer recognized.
- Remote writes run only for the authenticated owner, and confirmed reads are filtered to that same `user_id`.
- Existing hosted rows with `NULL user_id` must be backfilled to a real Supabase auth user before a follow-up migration can safely mark `user_id` as `NOT NULL`.
