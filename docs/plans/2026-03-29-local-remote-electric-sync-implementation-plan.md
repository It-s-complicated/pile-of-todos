---
status: in-progress
phase: 1
updated: 2026-03-31
---

# Implementation Plan

## Goal
Replace the current dual local/remote sync coupling with one Supabase-backed client write path, one Electric-confirmed read baseline, and one user-partitioned optimistic ledger that survives resets, offline work, and auth transitions.

## Context & Decisions
| Decision | Rationale | Source |
|----------|-----------|--------|
| Use one merged read path and one mutation API | TanStack/Electric guidance favors synced baseline + optimistic overlay and explicitly warns against caller-managed dual writes | `ref:developing-coffee-barnacle` |
| Keep the architecture frontend-only with no app-managed server | README and current repo structure describe a frontend-only app; approved direction explicitly rules out `server/`, `/api/*`, and app-owned proxy/write layers | user-approved direction + repo context |
| Refactor away from `useTodoData` / `useTodoSync` coupling | Current composables mix auth, storage partitioning, guest migration, Electric transport, and manual reconciliation in ways the new design must separate | `ref:arbitrary-jade-hummingbird` |
| Keep `todos.user_id` as the ownership and scope boundary | Existing RLS and Electric scoping already use `user_id`, so the new flow should preserve that boundary | `ref:arbitrary-jade-hummingbird` |
| Require txid-backed confirmation before clearing optimistic state | Accepted pattern remains write acceptance → return `txid` → await Electric confirmation, and the expected implementation is a Supabase RPC/database function. Alternatives are allowed only if they preserve the same auth-context, durable idempotency, and txid guarantees rather than introducing an app server endpoint | `ref:developing-coffee-barnacle` + user-approved direction |
| Keep direct browser Supabase writes and Electric reads, but move them behind a stronger client contract | `src/composables/useTodoSync.ts` already writes via Supabase from the browser, and `src/db/collections.ts` already configures Electric as a client-side read transport | repo context |

## Phase 1: Client-Only Supabase + Electric Sync Contract [IN PROGRESS]
- [ ] **1.1 Create `src/lib/todo-mutation-contract.ts` to define the client-side create/update/delete intent payloads, accepted response contract `{ mutationId, todoId, txid }`, status model, and exact wire expectations: `txid` comes from Postgres `pg_current_xact_id()` and is serialized to the client as a string** ← CURRENT
- [ ] 1.2 Add database-side write-contract support via Drizzle-managed SQL migration output in `src/db/out/` (and `src/db/schema.ts` if schema objects must be declared) for the expected Supabase RPC / database function that accepts authenticated create/update/delete mutation intents, derives the acting user inside the function from Supabase/Postgres auth context (`auth.uid()` or equivalent), and never trusts caller-supplied ownership scope or `user_id` for authorization
- [ ] 1.3 In the same Phase 1 database work, add the durable idempotency artifact for that RPC/function: a mutation journal / ledger table or equivalent durable DB mechanism with a uniqueness constraint on `mutationId` and stored accepted result metadata so retries, network loss, and offline replay return the same accepted `{ mutationId, todoId, txid }` outcome without duplicating effects
- [x] 1.4 Ensure the RPC/function performs the todo mutation and captures `txid` from `pg_current_xact_id()` in the same accepting transaction before returning the accepted `{ mutationId, todoId, txid }` contract
- [ ] 1.5 Replace the raw `supabase.from('todos').upsert(...)` write path in `src/composables/useTodoSync.ts` with the direct Supabase mutation contract from 1.2-1.4; do not keep any optional fallback to raw table writes that cannot return the accepted `{ mutationId, todoId, txid }` contract
- [ ] 1.6 Add or refactor client helpers in `src/lib/todo-sync.ts` (and nearby Supabase utilities if needed) so browser writes consistently attach `mutationId`, stable `todoId`, and any required device metadata before dispatch to the database contract, while leaving ownership/auth derivation to the database function
- [ ] 1.7 Update `src/db/collections.ts` Electric configuration to reflect the approved role explicitly: client-side read transport only, auth-scoped by `user_id`, with no app-owned proxy assumptions in code comments or env fallback behavior
- [ ] 1.8 Update `src/env.d.ts`, `README.md`, and related plan/docs language so the environment contract clearly documents a frontend-only architecture: Supabase for writes/auth, Electric for reads, and no `server/` runtime or `/api/*` routes

## Phase 2: Client Data Layer Split [PENDING]
- [ ] 2.1 Repurpose `src/lib/todo-sync.ts` and adjacent client helpers to hold Supabase mutation request/response mapping, txid confirmation wiring, and todo row translation instead of direct ad hoc push/reconcile logic
- [ ] 2.2 Create `src/db/confirmed-todos.ts` for the Electric-backed confirmed baseline collection and reduce `src/db/collections.ts` to shared schema/types plus local UI-only collections
- [ ] 2.3 Create `src/lib/pending-mutation-storage.ts` plus `src/lib/pending-mutation-storage.test.ts` for the durable user-partitioned ledger and distinct pre-auth guest migration partition
- [ ] 2.4 Create `src/lib/todo-overlay.ts`, `src/lib/todo-reconciliation.ts`, and focused tests to implement the approved conflict rules, txid confirmation proof checks, quarantine path, and reset/refetch reconciliation
- [ ] 2.5 Create `src/composables/useTodoReadModel.ts` and `src/composables/useTodoSyncController.ts` so baseline reads, overlay derivation, and transport state are composed without UI-specific branching

## Phase 3: Replace Legacy Sync Orchestration [PENDING]
- [ ] 3.1 Add `src/composables/useTodoMutations.ts` as the only public write surface for create/update/delete/restore; route all UI writes through ledger creation + direct Supabase mutation calls + txid confirmation
- [ ] 3.2 Refactor `src/composables/useTodoData.ts` to stop owning local-vs-remote selection, guest-claim side effects, and direct collection writes; keep only thin adapters that are still needed by callers
- [ ] 3.3 Refactor `src/composables/useTodoSync.ts` to remove fingerprint-based reconciliation and direct `supabase.from('todos').upsert(...)` writes in favor of the sync controller and Supabase RPC/direct mutation contract
- [ ] 3.4 Add the new sync/degraded/migration status model to the client composables (`src/composables/useElectricTodos.ts`, `src/composables/useSyncElectricTodos.ts`) and update their exposed API accordingly
- [ ] 3.5 Update UI consumers (`src/components/SyncStatus.vue`, `src/components/TodoList.vue`, `src/App.vue`, and any affected views) to consume the merged read model and render the new statuses without local-vs-remote branching

## Phase 4: Migration, Export, and Cleanup [PENDING]
- [ ] 4.1 Update `src/lib/todo-storage.ts` and `src/composables/useDataExport.ts` so legacy guest/account buckets become migration input only, flow through the pre-auth guest migration partition, and leave the merged synced view only after confirmed migration
- [ ] 4.2 Reduce or delete obsolete helpers in `src/composables/useTodos.ts`, `src/composables/useCloudSync.ts`, and any dead branches in `src/db/collections.ts` that preserve the old local-storage-authoritative model
- [ ] 4.3 Extend tests in `src/lib/todo-sync.test.ts`, `src/lib/todo-storage.test.ts`, and the new ledger/overlay/reconciliation tests to cover: offline create, retry idempotency, Electric `409` reset, auth refresh vs user switch, pending remote conflict, and accepted-but-unconfirmed invariant violation

## Phase 5: Verification and Documentation [PENDING]
- [ ] 5.1 Run `vp check` and fix any lint/type/format regressions introduced by the refactor
- [ ] 5.2 Run `vp test` and fix failing library tests until the sync-specific suite passes on the new architecture
- [ ] 5.3 Run `vp build` to verify the app still type-checks and produces a production bundle for the updated frontend-only Supabase/Electric architecture
- [ ] 5.4 Update `README.md` troubleshooting/status language to match the final runtime behavior and record any operator-facing degraded-state guidance discovered during implementation

## Notes
- 2026-03-31: The existing repo is frontend-only today, and the approved direction keeps it that way; Phase 1 is therefore a client-contract phase, not server bootstrap work
- 2026-03-31: Keep `todos.user_id` as the single auth and Electric scoping boundary; do not invent a second ownership model `ref:arbitrary-jade-hummingbird`
- 2026-03-31: The approved behavioral contract is `docs/plans/2026-03-29-local-remote-electric-sync-design.md`, especially its write flow, recovery, auth-expiry, rollout/migration, and verification sections
- 2026-03-31: Retry idempotency depends on client-supplied `mutationId` surviving offline/retry cycles and being enforced durably in the database by the expected Supabase RPC / database function plus a journal / ledger table or equivalent durable DB artifact, not by raw `supabase.from('todos')` table writes and not by an app-owned server `ref:developing-coffee-barnacle`
- 2026-03-31: Phase 1.4 is satisfied by `src/db/out/0005_todo_mutation_ledger.sql`, where `apply_todo_mutation(intent jsonb)` binds `accepted_txid xid8 := pg_current_xact_id()`, uses that txid for the accepted ledger row, and returns the same txid from the same function transaction after each successful todo create/update/delete path
