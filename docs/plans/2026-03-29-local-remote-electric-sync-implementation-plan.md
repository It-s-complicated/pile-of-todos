---
status: in-progress
phase: 1
updated: 2026-03-29
---

# Implementation Plan

## Goal
Replace the current dual local/remote sync coupling with one Postgres-backed write path, one Electric-confirmed read baseline, and one user-partitioned optimistic ledger that survives resets, offline work, and auth transitions.

## Context & Decisions
| Decision | Rationale | Source |
|----------|-----------|--------|
| Use one merged read path and one mutation API | TanStack/Electric guidance favors synced baseline + optimistic overlay and explicitly warns against caller-managed dual writes | `ref:developing-coffee-barnacle` |
| Add a server-side Electric proxy and Postgres write endpoint | Electric is read-only from clients, needs a proxy for auth/shape control, and the repo currently has no `server/` or `api/` boundary | `ref:developing-coffee-barnacle` |
| Refactor away from `useTodoData` / `useTodoSync` coupling | Current composables mix auth, storage partitioning, guest migration, Electric transport, and manual reconciliation in ways the new design must separate | `ref:arbitrary-jade-hummingbird` |
| Keep `todos.user_id` as the ownership and scope boundary | Existing RLS and Electric scoping already use `user_id`, so the new flow should preserve that boundary | `ref:arbitrary-jade-hummingbird` |
| Require txid-backed confirmation before clearing optimistic state | Research identified the accepted pattern as API write → return `txid` → await Electric confirmation | `ref:developing-coffee-barnacle` |

## Phase 1: Server Sync Boundary [IN PROGRESS]
- [ ] **1.1 Create the backend entrypoint and dev wiring in `server/index.ts`, `server/router.ts`, `server/db.ts`, `package.json`, `vite.config.ts`, and `tsconfig.node.json` so `/api/*` requests have a real server target and server code has a single Drizzle/Postgres bootstrap** ← CURRENT
- [ ] 1.2 Add `server/lib/get-auth-user.ts` and `server/lib/server-env.ts` to validate Supabase bearer tokens server-side and centralize non-`VITE_*` Electric/Postgres env access
- [ ] 1.3 Add `server/routes/electric-todos.ts` to proxy Electric safely: forward only Electric protocol params, inject the server-defined `todos` shape with `user_id = $1`, strip `content-encoding` / `content-length`, and expose `electric-offset,electric-handle,electric-schema,electric-cursor`
- [ ] 1.4 Add `server/lib/todo-write-service.ts` and `server/routes/todo-mutations.ts` to accept client-supplied create/update/delete intents, persist and dedupe by `mutationId` for retry safety, write through one Drizzle transaction via `server/db.ts`, and return `{ mutationId, todoId, txid }`
- [ ] 1.5 Update `src/env.d.ts` and `README.md` so Electric secrets move server-side and the new local dev / required env contract is documented clearly

## Phase 2: Client Data Layer Split [PENDING]
- [ ] 2.1 Extract shared contracts into `src/lib/todo-mutation-contract.ts` and repurpose `src/lib/todo-sync.ts` to hold API payload/response helpers instead of direct Supabase-row mapping only
- [ ] 2.2 Create `src/db/confirmed-todos.ts` for the Electric-backed confirmed baseline collection and reduce `src/db/collections.ts` to shared schema/types plus local UI-only collections
- [ ] 2.3 Create `src/lib/pending-mutation-storage.ts` plus `src/lib/pending-mutation-storage.test.ts` for the durable user-partitioned ledger and distinct pre-auth guest migration partition
- [ ] 2.4 Create `src/lib/todo-overlay.ts`, `src/lib/todo-reconciliation.ts`, and focused tests to implement the approved conflict rules, txid confirmation proof checks, quarantine path, and reset/refetch reconciliation
- [ ] 2.5 Create `src/composables/useTodoReadModel.ts` and `src/composables/useTodoSyncController.ts` so baseline reads, overlay derivation, and transport state are composed without UI-specific branching

## Phase 3: Replace Legacy Sync Orchestration [PENDING]
- [ ] 3.1 Add `src/composables/useTodoMutations.ts` as the only public write surface for create/update/delete/restore; route all UI writes through ledger creation + server calls + txid confirmation
- [ ] 3.2 Refactor `src/composables/useTodoData.ts` to stop owning local-vs-remote selection, guest-claim side effects, and direct collection writes; keep only thin adapters that are still needed by callers
- [ ] 3.3 Refactor `src/composables/useTodoSync.ts` to remove fingerprint-based reconciliation and direct `supabase.from('todos').upsert(...)` writes in favor of the sync controller / write endpoint contract
- [ ] 3.4 Add the new sync/degraded/migration status model to the client composables (`src/composables/useElectricTodos.ts`, `src/composables/useSyncElectricTodos.ts`) and update their exposed API accordingly
- [ ] 3.5 Update UI consumers (`src/components/SyncStatus.vue`, `src/components/TodoList.vue`, `src/App.vue`, and any affected views) to consume the merged read model and render the new statuses without local-vs-remote branching

## Phase 4: Migration, Export, and Cleanup [PENDING]
- [ ] 4.1 Update `src/lib/todo-storage.ts` and `src/composables/useDataExport.ts` so legacy guest/account buckets become migration input only, flow through the pre-auth guest migration partition, and leave the merged synced view only after confirmed migration
- [ ] 4.2 Reduce or delete obsolete helpers in `src/composables/useTodos.ts`, `src/composables/useCloudSync.ts`, and any dead branches in `src/db/collections.ts` that preserve the old local-storage-authoritative model
- [ ] 4.3 Extend tests in `src/lib/todo-sync.test.ts`, `src/lib/todo-storage.test.ts`, and the new ledger/overlay/reconciliation tests to cover: offline create, retry idempotency, Electric `409` reset, auth refresh vs user switch, pending remote conflict, and accepted-but-unconfirmed invariant violation

## Phase 5: Verification and Documentation [PENDING]
- [ ] 5.1 Run `vp check` and fix any lint/type/format regressions introduced by the refactor
- [ ] 5.2 Run `vp test` and fix failing library tests until the sync-specific suite passes on the new architecture
- [ ] 5.3 Run `vp build` to verify the app still type-checks and produces a production bundle with the new server/client split
- [ ] 5.4 Update `README.md` troubleshooting/status language to match the final runtime behavior and record any operator-facing degraded-state guidance discovered during implementation

## Notes
- 2026-03-29: The existing repo is frontend-only today, so Phase 1 is a prerequisite rather than optional cleanup `ref:arbitrary-jade-hummingbird`
- 2026-03-29: Keep `todos.user_id` as the single auth and Electric scoping boundary; do not invent a second ownership model `ref:arbitrary-jade-hummingbird`
- 2026-03-29: The approved behavioral contract is `docs/plans/2026-03-29-local-remote-electric-sync-design.md`, especially its write flow, recovery, auth-expiry, rollout/migration, and verification sections
- 2026-03-29: Retry idempotency depends on client-supplied `mutationId` surviving offline/retry cycles and being enforced on the server write path `ref:developing-coffee-barnacle`
