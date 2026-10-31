# Supabase TanStack DB compatibility

`@supabase-labs__tanstack-db@0.1.0.patch` updates the adapter's bundled declarations
for [TanStack DB's 1.0 RC migration](https://tanstack.com/db/latest/docs/guides/migrate-to-1-0-rc).
It uses the current `SyncConfig` instead of an inlined pre-RC signature containing
`markError` and `begin({ immediate })`, and removes the obsolete mutation-handler
return-type parameter. The runtime sync function forwards its context to Query
Collection, which is upgraded to 1.5.0 through the workspace override.

The application uses this adapter for confirmed reads and Realtime; all mutations
still go through the durable queue and `apply_todo_mutation`. The read-model
integration test exercises the real Vue, DB, Query, and Supabase adapters with
mocked network responses, including refetch failures and recovery.

Remove the patch and review the overrides when Supabase publishes an adapter
with DB 1.x-compatible declarations and dependency requirements.
