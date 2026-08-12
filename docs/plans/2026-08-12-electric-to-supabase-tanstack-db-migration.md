---
status: implemented-pending-rollout
updated: 2026-08-12
---

# Electric to Supabase TanStack DB Migration Plan

> Repository implementation completed on 2026-08-12. Applying the database
> migrations, validating two authenticated browser sessions, soaking the deploy,
> and retiring hosted Electric resources remain rollout operations.

## Goal

Replace Electric as the confirmed todo read transport with
`@supabase-labs/tanstack-db` while keeping TanStack DB, Supabase Auth,
Postgres, the `apply_todo_mutation` RPC, the database mutation ledger, and the
durable browser mutation queue.

This plan supersedes only the Electric-specific read and `txid` confirmation
parts of the March 2026 sync design. Its durable idempotency, per-user queue,
optimistic overlay, RPC write path, and single merged UI read model remain in
force.

## Chosen architecture

| Concern | Owner after migration |
| --- | --- |
| Authentication | Supabase Auth |
| Durable source of truth | Supabase Postgres |
| Browser reads | `@supabase-labs/tanstack-db` through PostgREST |
| Live collection queries | `@tanstack/vue-db` |
| Cross-device changes | Supabase Realtime, enabled after snapshot-read validation |
| Browser writes | Existing `apply_todo_mutation` Supabase RPC |
| Write idempotency | Existing `todo_mutation_ledger` table |
| Offline writes | Existing user-partitioned localStorage mutation queue |
| Optimistic UI | Existing pending-mutation overlay |

The Supabase collection is a confirmed-read collection. Application code must
not call its built-in `insert`, `update`, or `delete` persistence handlers,
because those handlers write directly through PostgREST and would bypass the
RPC's idempotency and soft-delete contract.

## Why this boundary

- The UI already consumes one TanStack DB collection through `useLiveQuery`, so
  the adapter can replace Electric without changing the page-level read model.
- The current RPC and database ledger already solve authenticated ownership and
  replay-safe writes. Replacing them with the adapter's direct mutations would
  remove useful guarantees.
- The existing browser queue already provides durable offline mutations. The
  adapter's own offline persistence is not ready and is not needed for this
  cutover.
- `@supabase-labs/tanstack-db` is experimental and currently published as
  `0.0.1`. Pin it exactly and keep the first production cutover independent of
  its Realtime integration.

References:

- [Supabase TanStack DB adapter](https://github.com/supabase/tanstack-db)
- [Adapter implementation](https://raw.githubusercontent.com/supabase/tanstack-db/main/src/db.ts)
- [Adapter query and mutation implementation](https://raw.githubusercontent.com/supabase/tanstack-db/main/src/functions.ts)
- [Supabase Realtime database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

## Phase 0: Preflight and database access

- [ ] Run `vp install` before editing and confirm the existing suite is green
  with `vp check`, `vp test`, and `vp build`.
- [ ] Re-check the adapter's latest published version, README warning, open
  issues, and peer/dependency compatibility. Do not silently move past `0.0.1`;
  review source and release notes before selecting a newer version.
- [ ] Confirm the Supabase Data API exposes `public.todos`. RLS is not a
  substitute for table/API access.
- [ ] Confirm the existing `todos_select_own` policy returns only rows where
  `user_id = auth.uid()` and that an anonymous request returns no todo rows.
- [ ] Add one migration using the repository's Drizzle migration workflow that:
  - explicitly grants `SELECT` on `public.todos` to `authenticated`;
  - revokes direct `INSERT`, `UPDATE`, and `DELETE` table privileges from
    `authenticated`, `anon`, and `public` so writes must use the RPC;
  - keeps the per-user `SELECT` RLS policy;
  - verifies `PUBLIC` and `anon` cannot execute `apply_todo_mutation`, while
    `authenticated` can.
- [ ] Do not remove `txid` from `todo_mutation_ledger` or change the RPC in this
  phase. Database cleanup is independent of the transport cutover.
- [ ] Add a focused database-contract test for the new grants/revokes and keep
  the existing RLS/RPC contract tests.

## Phase 1: Replace the confirmed-read collection

- [ ] Install exact `@supabase-labs/tanstack-db@0.0.1` and commit the lockfile.
  Keep `@tanstack/vue-db`.
- [ ] Rewrite `src/db/confirmed-todos.ts` around
  `supabaseCollectionOptions(...)` and `createCollection(...)` from
  `@tanstack/vue-db`:
  - `tableName: 'todos'`;
  - `keys: ['id']`;
  - the existing singleton Supabase browser client;
  - a Valibot schema for the actual snake_case PostgREST row;
  - `realtime: false` for the first cutover.
- [ ] Add one explicit snake_case row-to-`Todo` mapper. Reuse the existing
  `Todo` domain schema and do not spread transport-specific column names across
  components or composables.
- [ ] Expose a small `refreshConfirmedTodos()` helper backed by the collection's
  query/refetch utility. This becomes the only imperative confirmed-snapshot
  refresh primitive.
- [ ] Update `src/composables/useTodoReadModel.ts` to consume the Supabase-backed
  collection while preserving its existing public shape:
  `confirmedTodos`, `todos`, and `isReady`.
- [ ] Make auth scope explicit in the read-model lifecycle:
  - do not show a prior user's cached rows after sign-out or user change;
  - refetch after Supabase auth becomes ready and whenever the authenticated
    user changes;
  - treat an RLS-filtered empty response as the complete snapshot for that
    authenticated scope;
  - keep reactive dependencies in the `useLiveQuery` dependency array.
- [ ] Keep the existing pending-mutation overlay unchanged except for removing
  Electric-specific names in tests and comments.
- [ ] Add focused tests for:
  - snake_case PostgREST row mapping, including nullable columns;
  - signed-out empty state;
  - session restoration followed by a refetch;
  - user switching without briefly exposing the previous user's rows;
  - a successful full-snapshot replacement with zero rows.

## Phase 2: Replace Electric `txid` confirmation

The new confirmation contract is:

1. Persist a queued optimistic mutation.
2. Send it through `apply_todo_mutation`.
3. When the RPC returns successfully, persist the queue entry as `accepted`.
   The RPC response is the durable Postgres acceptance boundary.
4. Refresh the confirmed Supabase collection.
5. Remove the accepted queue entry only after that refresh succeeds, so the UI
   never drops its optimistic overlay before the authoritative snapshot is
   available.

- [ ] Replace `awaitConfirmedTodosTxid` with `refreshConfirmedTodos` in
  `src/composables/useTodoCreateQueueController.ts`.
- [ ] Replace the injectable `awaitTxid` test seam with an injectable
  `refreshConfirmedTodos` function.
- [ ] Remove the confirmation timeout constants. Query/RPC errors already have
  explicit retry behavior.
- [ ] On a refresh failure, retain the accepted entry and report a retryable
  error. Do not quarantine a mutation merely because a snapshot request had a
  transient network failure.
- [ ] On retry, accepted entries refresh the collection without repeating the
  already accepted mutation. Queued entries may repeat the RPC safely because
  the mutation ID is database-idempotent.
- [ ] Stop requiring or storing `txid` in new browser queue entries and accepted
  RPC result types.
- [ ] Preserve backward compatibility with queue JSON written by the Electric
  version. Existing `txid` fields must be tolerated and discarded during parse;
  existing `accepted` entries must follow the new refresh-and-resolve path.
- [ ] Keep the database ledger and its `txid` column for now. Removing it offers
  no cutover benefit and would combine a read-transport migration with a
  database-contract migration.
- [ ] Update sync status language so `awaiting-confirmation` means an accepted
  RPC is waiting for a successful Supabase snapshot refresh, not an Electric
  transaction stream.
- [ ] Update tests to cover:
  - optimistic work remains visible until the post-RPC refresh completes;
  - successful refresh clears an accepted entry;
  - failed refresh preserves an accepted entry and retries later;
  - accepted legacy entries containing `txid` migrate safely;
  - RPC retry reuses the same `mutationId`;
  - offline create/update/delete behavior is unchanged;
  - reauthentication resumes the queue;
  - a user switch never replays another user's queue.

## Phase 3: Enable Supabase Realtime

- [ ] Validate the snapshot-only version in development or staging before
  enabling Realtime. Exercise startup, focus/reconnect, auth changes, and every
  mutation kind.
- [ ] Add `public.todos` to the `supabase_realtime` publication with an
  idempotent migration that first checks `pg_publication_tables`.
- [ ] Do not add `REPLICA IDENTITY FULL`: deletes are soft deletes represented by
  `UPDATE`, and the adapter receives the new update row.
- [ ] Change the collection to `realtime: true`.
- [ ] Test with two authenticated browser sessions that create, update, archive,
  restore, and soft-delete todos propagate without a manual refresh.
- [ ] Confirm RLS prevents delivery of rows belonging to any other user.
- [ ] Observe Realtime message counts during the test. The adapter currently
  subscribes to all changes for the table and relies on RLS rather than adding
  a `user_id` subscription filter.
- [ ] Use a free-plan test organization or a spend cap for initial validation,
  matching the adapter's experimental warning.
- [ ] If Realtime is unreliable or unexpectedly expensive, set
  `realtime: false` again and retain startup/focus/reconnect/post-write
  refetching. Do not build a custom subscription adapter during this migration.

## Phase 4: Remove Electric-specific application code

- [ ] Remove `@electric-sql/client` and
  `@tanstack/electric-db-collection`; keep `@tanstack/vue-db` and the Supabase
  adapter.
- [ ] Delete `src/db/electric-read-config.ts`,
  `src/db/electric-read-config.test.ts`, `src/db/electric-user-scope.ts`, and
  `src/db/electric-user-scope.test.ts`.
- [ ] Delete `src/lib/supabase-config.ts` after confirming it has no non-Electric
  callers.
- [ ] Remove `VITE_ELECTRIC_SHAPE_URL`, `VITE_ELECTRIC_SOURCE_ID`, and
  `VITE_ELECTRIC_SECRET` from runtime validation, type declarations, examples,
  deployment configuration, and documentation.
- [ ] Rename `useElectricTodos` to `useTodos` and update its UI/test imports.
  Keep its public API stable so the rename remains mechanical.
- [ ] Update `README.md`, `PRODUCT.md`, `AGENTS.md`, and relevant `.agents/`
  guidance to describe Supabase + TanStack DB and remove Electric setup,
  troubleshooting, and skill mappings.
- [ ] Preserve the March 2026 design documents as history, but add a short
  superseded note pointing to this plan rather than rewriting their historical
  decisions.
- [ ] Remove unused Electric agent skills/lock entries only if nothing else in
  the repository references them. This is tooling cleanup, not a runtime
  prerequisite.
- [ ] Update all remaining user-facing and test text that says “Electric
  confirmation” or “Electric baseline.”
- [ ] Run `rg -n '(electric|Electric|txid|awaitTxId)'` and review every remaining
  match. Database migration history and explicitly historical plan text may
  remain.

## Phase 5: Verification and rollout

### Automated checks

- [ ] `vp check`
- [ ] `vp test`
- [ ] `vp build`
- [ ] If toolchain or package behavior is unexpected, run `vp env doctor` before
  changing the design.

### Supabase integration checks

- [ ] An authenticated `SELECT` returns only the signed-in user's todos.
- [ ] An anonymous `SELECT` cannot read todos.
- [ ] Direct authenticated table insert/update/delete calls are denied.
- [ ] `apply_todo_mutation` remains callable by authenticated users and denied
  to `anon` and `PUBLIC`.
- [ ] An online mutation appears optimistically, is accepted once, refreshes the
  confirmed collection, and removes its queue entry without duplication.
- [ ] An offline mutation survives reload and completes after reconnect.
- [ ] A failed post-RPC refresh leaves the accepted mutation recoverable.
- [ ] Sign-out and user switching clear or hide the previous confirmed scope.
- [ ] Two clients receive Realtime updates after Phase 3 is enabled.

### Rollout sequence

1. Apply and verify the Data API/RLS/privilege migration.
2. Deploy the Supabase collection with `realtime: false` while keeping the
   Electric service available for rollback and older cached PWA clients.
3. Validate snapshot reads and the new accepted-mutation refresh handshake.
4. Enable and observe Realtime.
5. After a soak period and confirmation that old PWA bundles have updated,
   remove Electric application dependencies and configuration.
6. Disconnect Electric before cleaning its Postgres resources. Inspect
   `pg_replication_slots` and `pg_publication` and remove only the exact Electric
   slot/publication names that exist; do not assume names or delete unrelated
   replication resources.
7. Rotate or delete the former Electric secret after old clients no longer need
   it.

### Rollback

- Keep the previous deployable bundle and Electric service available through
  the snapshot-only validation period.
- Database changes are additive or privilege-hardening changes compatible with
  the RPC write path. If the new client fails, restore the previous frontend
  bundle and restore only privileges that the previous bundle demonstrably
  requires.
- Do not drop Electric's replication slot/publication until rollback is no
  longer required.

## Success criteria

- No production browser request depends on Electric.
- TanStack DB and `useLiveQuery` remain the UI-facing read layer.
- Supabase RLS scopes every confirmed read to the authenticated user.
- All application writes still pass through `apply_todo_mutation` with stable
  mutation IDs and durable database idempotency.
- Offline queued mutations, optimistic overlay behavior, auth recovery, and
  user partitioning continue to work.
- The browser contains no Electric source secret or Electric runtime
  configuration.
- Cross-device changes update the collection through Supabase Realtime, or the
  documented snapshot-refetch fallback remains enabled if the experimental
  integration is not acceptable.

## Explicit non-goals

- Do not replace the RPC/ledger with the adapter's direct mutations.
- Do not add an app-owned backend or proxy.
- Do not build a custom TanStack DB collection adapter.
- Do not add PowerSync, RxDB, PGlite, or another local database.
- Do not add persisted confirmed-snapshot storage during this migration. The
  current durable requirement is offline mutation survival; revisit snapshot
  persistence only if users need previously confirmed todos after a fully
  offline browser restart.
- Do not remove the database `txid` column in the initial cutover.
- Do not add pagination until a user can approach PostgREST's default 1,000-row
  response limit.
