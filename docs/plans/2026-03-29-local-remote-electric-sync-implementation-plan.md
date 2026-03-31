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
| Require txid-backed confirmation before clearing optimistic state | Accepted pattern remains write acceptance → return `txid` → await Electric confirmation, but the write contract must come directly from Supabase via RPC/database function or equivalent rather than an app server endpoint | `ref:developing-coffee-barnacle` + user-approved direction |
| Keep direct browser Supabase writes and Electric reads, but move them behind a stronger client contract | `src/composables/useTodoSync.ts` already writes via Supabase from the browser, and `src/db/collections.ts` already configures Electric as a client-side read transport | repo context |

## Phase 1: Client-Only Supabase + Electric Sync Contract [IN PROGRESS]
- [ ] **1.1 Create `src/lib/todo-mutation-contract.ts` to define the client-side create/update/delete intent payloads, accepted response contract `{ mutationId, todoId, txid }`, status model, and idempotency expectations for retries** ← CURRENT
- [ ] 1.2 Replace the raw `supabase.from('todos').upsert(...)` write path in `src/composables/useTodoSync.ts` with a direct Supabase-backed mutation contract, likely an RPC / database function or equivalent mutation path that can return `txid` without introducing an app-managed server
- [ ] 1.3 Add or refactor client helpers in `src/lib/todo-sync.ts` (and nearby Supabase utilities if needed) so browser writes consistently attach `mutationId`, stable `todoId`, auth scope, and any required device metadata before dispatch
- [ ] 1.4 Update `src/db/collections.ts` Electric configuration to reflect the approved role explicitly: client-side read transport only, auth-scoped by `user_id`, with no app-owned proxy assumptions in code comments or env fallback behavior
- [ ] 1.5 Update `src/env.d.ts`, `README.md`, and related plan/docs language so the environment contract clearly documents a frontend-only architecture: Supabase for writes/auth, Electric for reads, and no `server/` runtime or `/api/*` routes

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
- 2026-03-31: Retry idempotency depends on client-supplied `mutationId` surviving offline/retry cycles and being enforced by the Supabase-backed mutation contract / database layer rather than an app-owned server `ref:developing-coffee-barnacle`
