# Todo Sync Process (Local + Remote + ElectricSQL)

**Status:** Proposed  
**Last Updated:** 2026-03-29

## Goals

1. Every write is durable locally first.
2. Every write is eventually pushed to remote.
3. Reads prefer remote-backed state when online and healthy.
4. Out-of-sync scenarios are explicit, detectable, and recoverable.
5. The UI always knows whether data is `local_only`, `degraded`, `syncing`, or `healthy`.

## Core Model

Treat the app as 3 cooperating stores:

1. **Local Store (authoritative for UX responsiveness)**
   - Fast, always available.
   - Accepts all user writes immediately.
2. **Outbox (authoritative for pending writes)**
   - Persistent queue of operations not yet acknowledged by remote.
   - Each operation has deterministic idempotency key.
3. **Remote Mirror via Electric (authoritative for canonical cloud state when online)**
   - Stream remote table changes into a remote cache.
   - Used as preferred read source once considered healthy.

## Data Contract Requirements

For each todo record keep:

- `id`
- `user_id`
- `updated_at` (server timestamp)
- `updated_by_device_id`
- `version` (monotonic integer or server tx/order marker)
- `deleted_at` (soft delete)

For each outbox operation keep:

- `op_id` (uuid)
- `entity_id` (todo id)
- `op_type` (`insert` | `update` | `delete`)
- `payload` (patch or full row)
- `base_version` (local view when mutation created)
- `created_at_local`
- `attempt_count`
- `next_retry_at`
- `status` (`pending` | `in_flight` | `acked` | `failed` | `conflicted`)

## Write Path (Always Local-First)

### Step-by-step

1. User action mutates local todo state immediately.
2. Append corresponding operation to outbox in same logical transaction.
3. Mark todo as `sync_pending=true` and attach `last_local_mutation_id`.
4. Sync worker sends outbox ops in deterministic order (FIFO per entity, globally stable order).
5. Server applies operation idempotently.
6. Server returns canonical row (or conflict result), including latest `version` and `updated_at`.
7. Client marks op `acked` and clears `sync_pending` for that mutation chain.
8. Electric stream later replays canonical row; client reconciler confirms parity.

### Important invariants

- Never drop an outbox item until a remote acknowledgement is recorded.
- Retrying same op must be safe (idempotency key required).
- New local writes can supersede older queued writes for same entity by compaction rules.

## Read Path (Remote Preferred When Online)

Use a source selector:

1. If offline: read from local store.
2. If online but Electric not yet healthy: read local store + `syncing/degraded` badge.
3. If online and Electric healthy: read merged view with remote precedence for confirmed fields.

### “Electric Healthy” criteria

All true:

- shape subscription connected,
- initial snapshot received,
- no fatal auth/permission errors,
- replication lag under threshold (for example 10s),
- last heartbeat within threshold.

If any check fails, downgrade to `degraded` and continue rendering local data.

## Merge/Reconciliation Rules

Use deterministic rule order:

1. If row exists only local and has pending outbox ops -> keep local visible.
2. If row exists only remote -> insert into local mirror.
3. If both exist and local has no pending op:
   - adopt remote canonical row.
4. If both exist and local has pending op:
   - if remote version >= acked base and conflicts with local pending change, mark `conflicted` and surface resolution UI.
   - else keep optimistic local until ack/failure.

### Conflict policy

Default policy for todos:

- Field-level last-write-wins by `updated_at` for simple boolean/text fields.
- Deletion wins over stale updates when `deleted_at` is newer.
- If both sides edited same field after same base version, flag manual conflict for user-visible resolution.

## Out-of-Sync Scenario Handling

### 1) Network outage during writes

- Keep writes local + queued in outbox.
- Exponential backoff with jitter.
- UI status: `local_only` with pending count.

### 2) Auth expired/revoked

- Pause outbox processing.
- Keep local writes queued.
- UI status: `degraded` with re-auth prompt.
- After re-auth, resume from outbox head.

### 3) Electric disconnected but API writes still work

- Continue outbox flush through write API.
- Do not trust remote read freshness until Electric health recovers.
- Trigger periodic checksum/fingerprint pulls to detect drift.

### 4) API accepted write but client crashed before ack persisted

- On restart, resend in-flight ops with same idempotency key.
- Server returns already-applied result; client marks acked.

### 5) Duplicate or out-of-order Electric events

- Apply only if event `version` is newer than local known canonical version.
- Ignore stale/replayed events.

### 6) Local DB corruption/reset

- Rebuild local mirror from Electric initial snapshot.
- Replay durable outbox entries (if stored separately) or mark unsynced data loss event.

### 7) Long offline branch (many edits across devices)

- On reconnect, process outbox first.
- Then run full reconciliation pass between local and remote fingerprints.
- Surface explicit conflict list if non-trivial divergences remain.

## Sync State Machine

```text
BOOTING
  -> OFFLINE_LOCAL_ONLY (no network)
  -> CONNECTING_REMOTE (network available)

CONNECTING_REMOTE
  -> CATCHING_UP (Electric snapshot/loading)
  -> DEGRADED (auth/config/shape error)

CATCHING_UP
  -> HEALTHY (snapshot + lag acceptable)
  -> DEGRADED (stream failed)

HEALTHY
  -> FLUSHING_OUTBOX (pending ops)
  -> DEGRADED (stream lag/error)
  -> OFFLINE_LOCAL_ONLY (network lost)

FLUSHING_OUTBOX
  -> HEALTHY (queue empty)
  -> DEGRADED (server rejects)
  -> OFFLINE_LOCAL_ONLY (network lost)

DEGRADED
  -> CONNECTING_REMOTE (recoverable)
  -> OFFLINE_LOCAL_ONLY (network lost)
```

## Operational Guardrails

1. **Observability**
   - Track counters: pending ops, retries, conflicts, lag ms, last successful sync.
2. **Background jobs**
   - periodic `reconcile pass` every N minutes when online,
   - periodic `drift fingerprint` check.
3. **Compaction**
   - collapse multiple pending updates for same todo into one patch before sending.
4. **Safety limits**
   - cap retries before surfacing hard error,
   - preserve failed ops for inspection/export.

## Recommended Implementation Sequence

1. Add persistent outbox abstraction (independent from UI collections).
2. Split read models into:
   - local optimistic projection,
   - remote canonical projection,
   - derived displayed projection.
3. Implement sync worker with retry/idempotency.
4. Implement health monitor for Electric stream.
5. Add deterministic reconciler + conflict registry.
6. Add UI states (`healthy`, `syncing`, `degraded`, `local_only`) and conflict resolution flow.
7. Add chaos tests (offline/online flaps, duplicate events, crash recovery).

## Acceptance Criteria

- A user can create/update/delete todos fully offline and see immediate local results.
- After reconnect, all operations are either remotely acknowledged or explicitly flagged.
- When online and healthy, displayed todos reflect remote canonical state.
- No silent data loss when app/tab crashes mid-sync.
- Conflict cases are visible and actionable, never hidden.
