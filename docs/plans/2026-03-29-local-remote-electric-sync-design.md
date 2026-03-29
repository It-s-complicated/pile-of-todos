# Local / Remote / Electric Sync Design

## Summary

Adopt a hybrid sync model for todos. Postgres is the durable source of truth. Electric is read and sync transport only. The client keeps a confirmed baseline from Electric plus a pending mutation ledger used for optimistic UI, retries, and recovery. The UI reads one merged todo view and never chooses between separate local and remote selectors.

## 1. Problem statement

The current sync shape mixes concerns between local persistence, remote durability, and Electric replication. That makes it too easy for the app to drift into manual dual writes, split-brain reads, and unclear recovery behavior.

The approved direction is to simplify the mental model:

- remote data owns durability and final acceptance
- Electric owns read-side sync transport
- local state owns optimistic presentation and temporary pending work only

This design removes permanent local-only todos and gives the UI one coherent read model.

## 2. Chosen architecture

Use a hybrid model with three distinct layers:

1. **Confirmed baseline**: the latest accepted todo state materialized from Electric for the authenticated user.
2. **Pending mutation ledger**: local records describing optimistic creates, updates, and deletes that have been sent, are queued, or need recovery.
3. **Sync transport state**: connection/auth/stream status for Electric and mutation delivery status for the write path.

The app derives a single merged read model by overlaying pending mutations on top of the confirmed baseline. Callers never read from separate local and remote collections.

## 3. Data ownership split

### Remote / Postgres

Postgres is the durable source of truth for accepted todos. It is authoritative for:

- whether a todo exists
- user ownership and auth-scoped visibility
- server timestamps
- canonical stored fields
- whether a mutation was accepted or rejected
- the confirmed final state visible after sync-back

### Electric

Electric is read-only from the client perspective. It is the transport that streams the server-confirmed baseline into the app. Electric does not own mutation intent and is not used as a separate writable local store.

### Local client state

Local client state is limited to:

- cached confirmed baseline data for fast startup and offline reads
- pending mutation ledger for optimistic overlay
- sync transport state

There are no permanent local-only todos. A todo may appear locally before server confirmation, but only as an optimistic pending item tied to a mutation.

## 4. Read flow and online/offline behavior

The UI reads a single merged todo view:

`merged view = confirmed baseline + optimistic overlay from pending mutation ledger`

Behavior by state:

- **Online and healthy**: Electric keeps the confirmed baseline current; pending mutations overlay until they sync back.
- **Offline**: the app continues to render the last confirmed baseline plus queued optimistic changes from the ledger.
- **Reconnecting**: Electric refreshes the confirmed baseline; the ledger is reconciled against newly confirmed rows.

This preserves one consistent selector path for the UI. Components should not branch into “local todos” vs “remote todos” logic.

## 5. Write flow

All writes go through one mutation API. Callers must not update local and remote state separately.

Recommended write sequence:

1. Generate a stable `todoId` on the client for creates.
2. Generate a unique `mutationId` for every create, update, or delete attempt.
3. Insert a pending ledger entry and optimistically project it into the merged read model.
4. Send the mutation to the server write endpoint.
5. Record the server response, including any transaction or acknowledgment metadata needed for sync-back confirmation.
6. Keep the mutation pending until the confirmed baseline reflects the accepted change.
7. Mark the ledger entry resolved once the Electric stream confirms the matching state.

Use stable client-generated todo IDs so create retries are idempotent. Combine `todoId` and `mutationId` to prevent duplicate effects across retries and reconnects.

When available, store the server transaction identifier (for example a Postgres txid) on the pending mutation. That allows the client to distinguish **request accepted** from **change observed in the Electric stream**. The ledger entry should remain in `accepted-awaiting-sync` until the matching sync-back arrives.

Pending mutation statuses should be explicit, for example:

- `queued`
- `sending`
- `accepted-awaiting-sync`
- `confirmed`
- `retryable-error`
- `rejected`

The important distinction is between server acceptance and confirmed sync-back. A write is not fully done when the request returns success; it is done when Electric reflects the accepted result in the confirmed baseline.

## 6. Out-of-sync recovery process

Recovery should assume that the merged view can always be rebuilt from:

- the last durable confirmed baseline cache
- the local pending mutation ledger
- a fresh Electric snapshot

Recovery policy:

1. If Electric reports reset / must-refetch / shape invalidation, clear only transport-specific sync position data.
2. Re-fetch a fresh Electric snapshot for the authenticated user.
3. Rebuild the confirmed baseline from that snapshot.
4. Re-apply unresolved pending ledger entries as optimistic overlay.
5. Reconcile each pending mutation against server-confirmed data.

For Electric `409` or equivalent shape-expired cases, the client should treat the stream position as invalid, fetch a fresh baseline, and then reconcile. Do not attempt ad hoc patching from stale offsets.

If a pending mutation cannot be matched after refetch, keep it in a retryable or rejected state based on the server result and reconciliation evidence.

## 7. Auth expiry handling

Auth expiry is a transport and write-path problem, not a reason to fork local data ownership.

Policy:

- pause outgoing mutations when auth is expired
- surface transport state that tells the UI re-auth is required
- resume Electric and mutation delivery only after session refresh succeeds
- keep pending ledger entries intact during auth interruptions
- never convert pending optimistic todos into permanent local-only records

If the user session changes, discard auth-scoped confirmed baseline data and rehydrate from the new user’s Electric stream before replaying relevant pending work.

## 8. Recommended module boundaries

Keep the implementation split by responsibility rather than storage technology.

### Confirmed baseline store

Owns Electric subscription, baseline cache hydration, snapshot replacement, and confirmed server state.

### Pending mutation ledger

Owns queued mutation records, status transitions, retry metadata, optimistic patch application, and reconciliation bookkeeping.

### Mutation API

The only public write surface for todos. Accepts intent like create/update/delete and performs ledger entry creation, request dispatch, idempotency handling, and txid/sync-back tracking.

### Merged read model

Builds the single UI-facing todo list by overlaying pending mutations on the confirmed baseline.

### Sync transport controller

Owns Electric connection lifecycle, reset/refetch handling, auth-aware pause/resume behavior, and sync health state.

UI components and feature composables should depend on the merged read model plus the single mutation API, not on separate local/remote modules.

## 9. Verification scenarios / success criteria

The design is successful if these scenarios behave predictably:

1. **Create online**: a new todo appears immediately, becomes server-accepted, then becomes confirmed after Electric sync-back without duplication.
2. **Create offline**: a new todo appears as pending, survives refresh from local cache, and confirms after reconnect.
3. **Update/delete retry**: repeated sends with the same `mutationId` do not create duplicate effects.
4. **Electric reset / 409**: the client refetches baseline, reapplies pending overlay, and returns to a correct merged view.
5. **Auth expiry mid-session**: pending work is preserved, writes pause, re-auth resumes sync, and ownership remains correct.
6. **Multi-device confirmation**: a change made elsewhere updates the confirmed baseline and merges cleanly with any local pending work.
7. **No dual-write paths**: no caller needs separate local mutation calls plus remote mutation calls.
8. **One read path**: UI selectors read only the merged view.

## 10. Explicit non-goals / things to avoid

Avoid the following:

- permanent local-only todos
- separate UI read paths for local and remote todos
- manual dual writes to local cache and server from callers
- treating Electric as the authoritative write path
- considering request success alone as final confirmation
- ad hoc recovery from stale Electric offsets after reset or `409`
- silent mutation duplication when retrying after reconnect
- mixing auth/session state into todo ownership rules outside the single mutation and sync layers

This design intentionally favors one durable authority, one merged read model, and one mutation entry point.
