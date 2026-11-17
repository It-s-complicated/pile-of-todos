# Supabase + TanStack DB

- Supabase Auth owns browser identity.
- `@supabase-labs/tanstack-db` is the confirmed-read transport through PostgREST and Realtime.
- TanStack DB `useLiveQuery` is the UI-facing read layer.
- Filter live queries by the active `user_id` even though RLS remains the security boundary.
- All writes use `apply_todo_mutation`; never call the adapter collection's direct mutation methods.
- Accepted queue entries remain in the optimistic overlay until `refreshConfirmedTodos()` succeeds.
- Direct table writes are revoked for browser roles; authenticated users receive `SELECT` plus RPC execution only.

## Mock backend (`vp run dev:mock`)

- `--mode mock` loads `.env.mock`, which points `VITE_SUPABASE_URL` at `http://localhost:5173/mock-supabase` (same origin, so port 5173 is required).
- `src/main.ts` starts MSW before importing the app; that is the only mock-aware line in app code. Never branch on mock mode anywhere else.
- Everything lives in `src/mocks/`: `handlers.ts` (Auth, PostgREST `todos`, the `apply_todo_mutation` RPC, a Realtime socket that only acknowledges joins), `database.ts` (localStorage-backed table + RPC rules mirroring the SQL), `postgrest.ts` (query-string filters), `auth.ts` (fake session and OAuth redirect).
- When the RPC or the read query changes, update `database.ts`/`postgrest.ts` to match; unsupported query syntax fails with a 400 on purpose.
- Reset mock data from the browser console with `mockBackend.reset()`.
