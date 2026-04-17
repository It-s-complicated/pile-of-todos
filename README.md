# Pile of Todos

A weekly planning todo app built with Vue 3, TanStack DB, and Tailwind CSS.

The runtime architecture is explicitly frontend-only:

- Supabase handles browser auth and browser write calls.
- Electric handles browser read sync / confirmed baseline reads.
- This app does **not** require an app-owned server runtime, proxy, or `/api/*` routes.

## What it does

- Capture tasks into a backlog or assign them to upcoming week numbers.
- Navigate focused list views: Backlog, Current Week, Future, Unfinished, Finished, and Archived.
- Keep working offline with queued mutations that sync later.
- Import todo JSON into the same durable queued-mutation flow used by normal todo creation.
- Sync the signed-in account against the shared cloud dataset when available.

## Environment variables

Create `.env.local` for frontend runtime variables. The app does not use server-only runtime env vars or an `API_BASE_URL` for app-owned `/api/*` routes. If you use Drizzle migration/push tooling, also provide `DATABASE_URL` in your shell environment or `.env.local`.

### Frontend (Vite) variables

| Variable                  | Required | Purpose                                                                 |
| ------------------------- | -------- | ----------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Yes      | Supabase project URL used by the browser for auth and write operations. |
| `VITE_SUPABASE_ANON_KEY`  | Yes      | Supabase publishable/anon key used by the browser client.               |
| `VITE_ELECTRIC_SHAPE_URL` | Yes      | Electric shape endpoint used directly by the browser for read sync.     |
| `VITE_DEVICE_ID`          | Yes      | Stable device identifier attached to client mutation intents.           |

The frontend runtime contract intentionally does **not** include `VITE_API_BASE_URL`, `VITE_ELECTRIC_PROXY_URL`, `VITE_ELECTRIC_SOURCE_ID`, `VITE_ELECTRIC_SECRET`, or other env vars that imply an app-owned server, proxy, or `/api/*` route layer.

### Backend/tooling variable

| Variable       | Required                                                                | Purpose                                                     | Behavior when missing                                                 |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL` | Required for Drizzle commands (`migrate`, `db:push`, `db:studio`, etc.) | PostgreSQL connection string for schema management tooling. | Drizzle commands fail at startup. Frontend app runtime is unaffected. |

## Auth and backend architecture note

- Current app is frontend-only; Supabase Auth handles authentication and Supabase database functions/tables handle browser writes.
- Electric is read transport only; it supplies confirmed, auth-scoped todo reads to the browser.
- No app-owned server runtime, proxy, or `/api/*` routes are required by this app.
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
- Browser write path: direct Supabase calls from the client
- Browser read path: direct Electric shape reads from the client
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

## Architecture overview

### `src/db`

- `collections.ts`
  - Defines the todo schema and collection models.
  - Uses LocalStorage-backed client state for cached baseline data, optimistic state, and offline behavior; confirmed reads come from Electric and writes go through Supabase.
  - Includes Electric read wiring and Supabase-backed client mutation handlers.
  - Exposes helpers like `isElectricConfigured()`, `getActiveCollection()`, and device-id helpers.
- `schema.ts`
  - Drizzle Postgres table definition and validation schemas for `todos`.
- `connection.ts`
  - Node-side Drizzle connection helper for migration/database tooling.

### `src/composables`

- `useElectricTodos.ts`
  - Main todo state + mutation API for UI.
  - Manages merged read state plus structured degraded / sync statuses.
  - Reconciles local optimistic state with the Electric-confirmed read baseline.
- `useDataExport.ts`
  - Export/import JSON with validation.
- `useNetworkStatus.ts`
  - Reactive online/offline browser connectivity tracking.
- `useWeekNumber.ts`
  - Week-number utility logic for planning buckets.

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
- `App.vue` hosts global layout, new task form, navigation pills, and sync status.

## Data import/export behavior

- Export creates a JSON payload containing:
  - `version`
  - `exportedAt`
  - `todos`
- Export serializes the current visible merged todo set when invoked programmatically; export is not currently exposed in the visible UI.
- Import validates the file structure and todo payload with Valibot before queueing any changes.
- **Import semantics:** imported todos are submitted through the same durable local mutation queue as manually created todos, so they appear immediately in the optimistic overlay and remain pending until Electric confirms them.

## Troubleshooting

### Offline mode expectations

- Signed-in sessions remain usable offline because pending mutations are stored locally and retried later.
- Signed-out sessions do not create or sync todos until authentication is restored.
- While transport prerequisites are unavailable (for example offline or signed out), the sync indicator shows **Paused**.

### Sync status meanings

- **Re-auth required**: pending work is blocked until the signed-in account refreshes its Supabase session.
- **Sync degraded**: an invariant or quarantine condition needs operator attention before normal sync can resume.
- **Retry pending**: at least one queued mutation failed retryably; use **Retry sync** when available.
- **Syncing...**: queued work is actively flushing.
- **Awaiting confirmation**: Supabase accepted the mutation, but Electric has not confirmed the returned `txid` yet.
- **Paused**: sync transport is unavailable or intentionally blocked, including offline, signed-out, or not-ready states.
- **Synced**: no degraded state or active sync delivery is pending.

### Common fixes

- If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing in `.env.local`, the app fails at startup with a configuration error instead of showing **Paused**.
- Confirm you are signed in with the allowed account before expecting create or remote sync; the app no longer falls back to unauthenticated writes.
- If GitHub sign-in redirects back with an auth error, verify the approved `provider_id` seed row and the registered auth hook function.
- Confirm your Supabase table/schema matches expected `todos` columns.
- If Drizzle tooling fails, set `DATABASE_URL` before running migration or studio commands.

## Supabase write hardening

- `todos.user_id` is now the ownership column used by both RLS policies and Electric read scoping.
- The browser client accepts only `VITE_SUPABASE_ANON_KEY`; `VITE_SUPABASE_KEY` is no longer recognized.
- Remote sync writes run only for the authenticated owner, and Electric reads are filtered to that same `user_id`.
- Existing hosted rows with `NULL user_id` must be backfilled to a real Supabase auth user before a follow-up migration can safely mark `user_id` as `NOT NULL`.
