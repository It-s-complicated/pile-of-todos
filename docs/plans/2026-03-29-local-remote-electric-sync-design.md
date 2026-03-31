# Local / Remote / Electric Sync Design

## Summary

Adopt a hybrid sync model for todos. Postgres is the durable source of truth. Electric is read and sync transport only. The client keeps a confirmed baseline from Electric plus a pending mutation ledger used for optimistic UI, retries, and recovery. Every accepted write must be confirmed by txid-backed sync-back before it is considered complete. The UI reads one merged todo view and never chooses between separate local and Postgres selectors.

## 1. Problem statement

The current sync shape mixes concerns between local persistence, remote durability, and Electric replication. That makes it too easy for the app to drift into manual dual writes, split-brain reads, and unclear recovery behavior.

The approved direction is to simplify the mental model:

- Postgres owns durability and final acceptance
- Electric owns read-side sync transport
- local state owns optimistic presentation and temporary pending work only

This design removes permanent local-only todos and gives the UI one coherent read model.

## 2. Chosen architecture

Use a hybrid model with three distinct layers:

1. **Confirmed baseline**: the latest accepted todo state materialized from Electric for the authenticated user.
2. **Pending mutation ledger**: local records describing optimistic creates, updates, and deletes that have been sent, are queued, or need recovery.
3. **Sync transport state**: connection/auth/stream status for Electric and mutation delivery status for the direct Supabase write path.

The app derives a single merged read model by overlaying pending mutations on top of the confirmed baseline. Callers never read from separate local and Postgres collections.

## 3. Data ownership split

### Postgres

Postgres is the durable source of truth for accepted todos. It is authoritative for:

- whether a todo exists
- user ownership and auth-scoped visibility
- database-managed timestamps
- canonical stored fields
- whether a mutation was accepted or rejected
- the confirmed final state visible after sync-back

### Electric

Electric is read-only from the client perspective. It is the transport that streams the Postgres-confirmed baseline into the app. Electric does not own mutation intent and is not used as a separate writable local store.

### Local client state

Local client state is limited to:

- cached confirmed baseline data for fast startup and offline reads
- pending mutation ledger for optimistic overlay
- sync transport state

There are no permanent local-only todos. A todo may appear locally before Postgres confirmation, but only as an optimistic pending item tied to a mutation.

## 4. Read flow and online/offline behavior

The UI reads a single merged todo view:

`merged view = confirmed baseline + optimistic overlay from pending mutation ledger`

Behavior by state:

- **Online and healthy**: Electric keeps the confirmed baseline current; pending mutations overlay until they sync back.
- **Offline**: the app continues to render the last confirmed baseline plus queued optimistic changes from the ledger.
- **Reconnecting**: Electric refreshes the confirmed baseline; the ledger is reconciled against newly confirmed rows.

This preserves one consistent selector path for the UI. Components should not branch into “local todos” vs “Postgres todos” logic.

## 5. Write flow

There is no app-managed server in this architecture. Supabase is the browser-facing write/auth backend, while Electric remains the external read/sync transport for Postgres-confirmed state. All writes go through one client-side mutation API backed directly by Supabase. Callers must not update local state and Postgres separately.

Recommended write sequence:

1. Generate a stable `todoId` on the client for creates.
2. Generate a unique `mutationId` for every create, update, or delete attempt.
3. Insert a pending ledger entry and optimistically project it into the merged read model.
4. Send the mutation through a Supabase RPC / database function. This is the expected implementation path. Any alternative database primitive is acceptable only if it preserves the exact same auth, durable idempotency, and txid guarantees described here.
5. The database contract must accept create/update/delete intent, derive the acting user from authenticated Supabase/Postgres auth context such as `auth.uid()` inside the function, and must not trust caller-provided ownership scope or `user_id` for authorization decisions.
6. The database contract must implement durable idempotency at the database level, not as a best-effort preflight check. The expected mechanism is a mutation journal / ledger table keyed by `mutationId` with a uniqueness constraint and stored accepted result metadata so retries, network loss, and offline replay return the same accepted outcome without duplicating effects.
7. Require the write response to return the accepted `mutationId`, `todoId`, and authoritative Postgres transaction identifier (`txid`), where `txid` is obtained from `pg_current_xact_id()` in the accepting transaction and serialized to the client as a stable string value.
8. Move the ledger entry to `accepted-awaiting-sync` only after Postgres accepts the write and returns that confirmation contract.
9. Store the accepted `txid` on the pending ledger entry and hand it to the Electric-backed collection or sync controller.
10. Wait on an explicit txid confirmation primitive such as `awaitTxId(txid)` or an equivalent stream-confirmation API.
11. Only after that txid confirmation resolves, evaluate the rebuilt confirmed baseline against the operation-specific confirmation proof.
12. Mark the ledger entry resolved only after both txid confirmation and the proof check succeed.

Use stable client-generated todo IDs so create retries are idempotent. Combine `todoId` and `mutationId` to prevent duplicate effects across retries and reconnects.

Txid-backed sync-back confirmation is mandatory for this architecture. The client must distinguish **Postgres accepted the write** from **Electric has delivered the confirmed Postgres result**. The concrete protocol is: the Supabase-backed mutation contract returns `{ mutationId, todoId, txid }`, the client stores that accepted `txid` on the pending mutation entry, and the Electric-backed collection or sync controller must use an explicit confirmation primitive such as `awaitTxId(txid)` or equivalent before the mutation can be marked confirmed.

The write contract is normative, not optional. Writes must use a Supabase RPC / database function by default. Any alternative database primitive is acceptable only if it preserves the same guarantees. The required contract is:

- accepts authenticated create/update/delete intents
- derives the acting user inside the database contract from authenticated Supabase/Postgres auth context and does not authorize from caller-supplied ownership scope or `user_id`
- implements durable database-level idempotency for `mutationId`, with a journal / ledger table or equivalent durable artifact that records the accepted result
- returns `{ mutationId, todoId, txid }`, where `txid` comes from `pg_current_xact_id()` and is serialized as a string for the client contract
- gives the client a reliable accepted-write contract that Electric confirmation can prove against

Raw direct table `insert`, `upsert`, `update`, or `delete` calls are not sufficient unless they provide those same guarantees in one contract.

Confirmation proof is operation-specific:

- **Create**: Electric must show a confirmed row with the same `todoId` in the rebuilt baseline after the accepted `txid`.
- **Update**: Electric must show the same `todoId` with every field targeted by that mutation set to the accepted values in the rebuilt baseline after the accepted `txid`.
- **Delete**: Electric must no longer show that `todoId` in the rebuilt baseline after the accepted `txid`.

Snapshot content by itself is not sufficient. Baseline content checks are evaluated only after the txid confirmation primitive resolves. There is no weaker snapshot-only confirmation path.

Pending mutation statuses should be explicit, for example:

- `queued`
- `sending`
- `accepted-awaiting-sync`
- `confirmed`
- `retryable-error`
- `rejected`

The important distinction is between backend acceptance and confirmed sync-back. A write is not fully done when the request returns success; it is done when Electric reflects the accepted result in the confirmed baseline.

### Conflict resolution while a local mutation is pending

If Electric delivers a Postgres change for the same `todoId` while a local mutation is still pending, use these rules:

- **Pending create**: keep rendering the optimistic todo until Electric shows the created row for that `todoId`, then replace the optimistic copy with the confirmed row.
- **Pending update**: keep the local optimistic fields visible for the fields being mutated. Non-overlapping fields may update from Electric immediately.
- **Pending delete**: keep the todo hidden in the merged view even if Electric still shows the pre-delete row until the delete is confirmed or rejected.
- **Confirmed newer Postgres state**: if Electric satisfies the operation-specific confirmation proof, mark the mutation confirmed even if additional Postgres-side fields also changed.
- **Rejected or conflicting result from Postgres**: drop the optimistic overlay for that mutation and show the confirmed Postgres row.

This app should not attempt per-field collaborative merges beyond those rules. The local pending mutation wins visually for its targeted fields until Postgres either confirms or rejects it.

## 6. Out-of-sync recovery process

Recovery should assume that the merged view can always be rebuilt from:

- the last durable confirmed baseline cache
- the local pending mutation ledger
- a fresh Electric snapshot

Recovery policy:

1. If Electric reports reset / must-refetch / shape invalidation, clear only transport-specific sync position data.
2. Re-fetch a fresh Electric snapshot for the authenticated user.
3. Rebuild the confirmed baseline from that snapshot.
4. Re-apply unresolved pending ledger entries from the active auth partition as optimistic overlay.
5. Reconcile each pending mutation against Postgres-confirmed data.

For Electric `409` or equivalent shape-expired cases, the client should treat the stream position as invalid, fetch a fresh baseline, and then reconcile. Do not attempt ad hoc patching from stale offsets.

After refetch, unmatched pending mutations must resolve by operation type:

- **Create**: if Postgres baseline now contains the `todoId`, mark confirmed; if Postgres never accepted it, keep `queued` or `retryable-error`; if Postgres explicitly rejected it, mark `rejected` and remove the optimistic row.
- **Update**: if the baseline reflects the intended field values, mark confirmed; if the baseline still shows the old values and there is no acceptance record, keep `queued` or `retryable-error`; if Postgres rejected the update, mark `rejected` and restore the confirmed row.
- **Delete**: if the baseline no longer contains the `todoId`, mark confirmed; if the row is still present and there is no acceptance record, keep `queued` or `retryable-error`; if Postgres rejected the delete, mark `rejected` and show the confirmed row again.

Fail fast on accepted-but-unconfirmed mutations. If a mutation already has accepted metadata including `txid`, Electric has reset, refetched, or resumed, and txid confirmation cannot be re-established or the rebuilt confirmed baseline still does not satisfy the confirmation proof after txid confirmation, do not downgrade it to ordinary retryable work. Move it to an invariant-violation or quarantined degraded state, stop treating it as a normal pending retry, and surface the problem loudly for operator debugging.

## 7. Auth expiry handling

Auth expiry is a transport and direct-Supabase-write problem, not a reason to fork local data ownership.

Policy:

- partition the pending mutation ledger by auth principal / user id
- pause outgoing mutations when auth is expired
- surface transport state that tells the UI re-auth is required
- keep the same auth partition active during token refresh
- resume Electric and mutation delivery only after session refresh succeeds
- keep pending ledger entries intact during auth interruptions
- never convert pending optimistic todos into permanent local-only records

If the session refreshes for the same user, continue using that user’s confirmed baseline and pending ledger partition.

If the authenticated user actually changes, quarantine the old user’s pending ledger entries and old confirmed-baseline cache immediately. Do not replay old-user pending mutations under the new user automatically. Rehydrate the new user’s confirmed baseline from that user’s Electric stream and start with the new user’s own ledger partition only.

## 8. Rollout and migration from the current app model

The current app may still contain guest or local data from the older local-first model. Migration should be explicit:

- existing guest/local todos become migration input, not a permanent parallel source of truth
- on first run of the new model, import those rows into a clearly separate **pre-auth guest migration partition**
- if no authenticated user exists, keep them in that pre-auth guest migration partition only; do not treat them as normal synced todos yet
- once the user authenticates and chooses to keep that data, create normal pending `create` mutations with stable client `todoId` values and send them through the single mutation API
- after Postgres acceptance and Electric confirmation, remove the legacy guest/local copy
- if the user declines migration, keep the legacy dataset quarantined and out of the merged synced view

## 9. Recommended module boundaries

Keep the implementation split by responsibility rather than storage technology.

### Confirmed baseline store

Owns Electric subscription, baseline cache hydration, snapshot replacement, and confirmed backend state.

### Pending mutation ledger

Owns user-partitioned queued mutation records, status transitions, retry metadata, optimistic patch application, quarantine behavior on user switch, and reconciliation bookkeeping.

### Mutation API

The only public write surface for todos. Accepts intent like create/update/delete and performs ledger entry creation, request dispatch through the client-side Supabase mutation contract, idempotency handling, and required txid/sync-back tracking.

### Merged read model

Builds the single UI-facing todo list by overlaying pending mutations on the confirmed baseline.

### Sync transport controller

Owns Electric connection lifecycle, reset/refetch handling, auth-aware pause/resume behavior, direct-Supabase mutation delivery coordination, and sync health state.

UI components and feature composables should depend on the merged read model plus the single mutation API, not on separate local/Postgres modules.

## 10. Verification scenarios / success criteria

The design is successful if these scenarios behave predictably:

1. **Create online**: a new todo appears immediately, becomes backend-accepted, then becomes confirmed after Electric sync-back without duplication.
2. **Create offline**: a new todo appears as pending, survives refresh from local cache, and confirms after reconnect.
3. **Update/delete retry**: repeated sends with the same `mutationId` do not create duplicate effects.
4. **Pending conflict**: an incoming Electric change on the same todo follows the conflict rules and does not silently erase the local optimistic mutation.
5. **Electric reset / 409**: the client refetches baseline, reapplies pending overlay, and returns to a correct merged view.
6. **Auth expiry mid-session**: pending work is preserved in the same user partition, writes pause, and re-auth resumes sync.
7. **User switch**: old-user pending work is quarantined and is not replayed under the new user.
8. **Guest/local rollout**: legacy guest/local rows can be migrated through the single mutation API and disappear only after Postgres acceptance plus Electric confirmation.
9. **Multi-device confirmation**: a change made elsewhere updates the confirmed baseline and merges cleanly with any local pending work.
10. **No dual-write paths**: no caller needs separate local mutation calls plus Postgres mutation calls.
11. **One read path**: UI selectors read only the merged view.

## 11. Explicit non-goals / things to avoid

Avoid the following:

- permanent local-only todos
- separate UI read paths for local and Postgres todos
- manual dual writes to local cache and Postgres from callers
- treating Electric as the authoritative write path
- considering request success alone as final confirmation
- ad hoc recovery from stale Electric offsets after reset or `409`
- silent mutation duplication when retrying after reconnect
- replaying old-user pending mutations after a user switch
- mixing auth/session state into todo ownership rules outside the single mutation and sync layers

This architecture deliberately does not introduce an app-owned server, `server/` runtime, `/api/*` routes, or an Electric proxy. Supabase is the only browser-facing backend for auth and writes, Electric remains the external read/sync transport for Postgres, and the browser owns the optimistic ledger plus reconciliation flow.

This design intentionally favors one durable authority, one merged read model, and one mutation entry point.
