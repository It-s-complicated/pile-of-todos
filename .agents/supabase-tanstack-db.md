# Supabase + TanStack DB

- Supabase Auth owns browser identity.
- `@supabase-labs/tanstack-db` is the confirmed-read transport through PostgREST and Realtime.
- TanStack DB `useLiveQuery` is the UI-facing read layer.
- Filter live queries by the active `user_id` even though RLS remains the security boundary.
- All writes use `apply_todo_mutation`; never call the adapter collection's direct mutation methods.
- Accepted queue entries remain in the optimistic overlay until `refreshConfirmedTodos()` succeeds.
- Direct table writes are revoked for browser roles; authenticated users receive `SELECT` plus RPC execution only.
