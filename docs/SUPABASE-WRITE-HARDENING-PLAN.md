# Supabase Write Hardening Plan

**Status**: Proposed
**Last Updated**: 2026-03-06
**Scope**: Harden the browser-to-Supabase write path for security, correctness, and maintainability

## Summary

The current cloud sync write path uses the Supabase JavaScript client directly from the browser to `upsert` rows into `todos`. That is structurally fine for batched writes, but it is not yet hardened:

- The checked-in schema has no ownership column
- The repo does not define Row Level Security (RLS) policies
- The browser client accepts a generic `VITE_SUPABASE_KEY` fallback
- The current index set is not clearly aligned with real query patterns

This plan documents the work needed to make the integration safe and reproducible.

## Current State

### What exists

- Browser writes go through `supabase.from('todos').upsert(...)`
- The table uses `id` as the primary key
- Writes are batched, which is preferable to many individual requests
- Electric is used for remote reads

### Main gaps

1. No explicit tenant or ownership boundary in the schema
2. No RLS policies represented in migrations
3. No forced separation between anon/publishable browser keys and other key names
4. No documented indexing strategy for future authenticated filtering

## Goals

- Make access control database-enforced instead of convention-based
- Represent all security-critical database changes in versioned migrations
- Restrict the browser client to the correct public key configuration
- Prepare the schema for authenticated per-user sync
- Keep the current offline-first sync model intact

## Non-Goals

- Rebuilding the sync architecture
- Adding multi-user collaboration features beyond per-user isolation
- Replacing Supabase writes with Edge Functions unless RLS proves insufficient
- Redesigning the local TanStack DB model

## Recommended Direction

Use authenticated browser writes with strict RLS on `todos`.

This keeps the existing architecture mostly intact while moving data isolation into Postgres, which is the main missing control. If later requirements need server-side validation, admin writes, or more complex conflict handling, an RPC or Edge Function layer can be added on top. That should be a second step, not the first one.

## Work Plan

### Phase 1: Define ownership in the schema

Add an ownership column to `todos`:

- Preferred: `user_id uuid not null`
- Reference source: Supabase Auth user id via `auth.uid()`

Tasks:

- Update the Drizzle schema
- Create a migration that adds `user_id`
- Backfill existing rows if needed for development data
- Mark the column `not null` once backfill is complete
- Add an index on `user_id`

Notes:

- `device_id` is not a secure ownership field and should remain metadata only
- If future sharing is needed, ownership and sharing should stay separate

### Phase 2: Enable and force RLS

Add security migrations for `todos`:

- `alter table todos enable row level security`
- `alter table todos force row level security`

Create policies for the `authenticated` role:

- `select`: user can read only their own rows
- `insert`: user can insert only rows where `user_id = auth.uid()`
- `update`: user can update only their own rows
- `delete`: user can delete only their own rows if hard deletes are ever used

Implementation notes:

- Follow Supabase guidance and write policy predicates with `(select auth.uid())`
- Index all columns used by policies, starting with `user_id`
- Keep policies simple and row-local

### Phase 3: Align the client with authenticated writes

Update the browser integration so it is explicit and hard to misconfigure:

- Accept only `VITE_SUPABASE_ANON_KEY`
- Remove `VITE_SUPABASE_KEY` fallback
- Ensure the app writes `user_id` on every inserted row
- Confirm authenticated sessions exist before cloud sync is considered enabled

Questions to resolve during implementation:

- Should cloud sync be disabled entirely for anonymous users?
- Should existing local todos remain local-only until sign-in?
- How should local rows be claimed after first sign-in?

Recommended default:

- Require sign-in for remote sync
- Keep offline local todos working without auth
- Migrate or claim local rows only after an explicit sync step

### Phase 4: Revisit index strategy

Review the existing indexes and keep only those justified by actual remote queries.

Candidates:

- Keep: primary key on `id`
- Add: index on `user_id`
- Consider: composite or partial indexes for common authenticated filters
- Re-evaluate: standalone indexes on `done` and `archived`

Likely direction:

- Replace broad low-selectivity indexes with narrower partial indexes if remote queries commonly filter active rows, such as `deleted_at is null`

### Phase 5: Validate failure modes and rollout

Before rollout, verify:

- Unauthenticated writes fail
- Authenticated users cannot read or mutate other users' rows
- Existing sync still works for the owning user
- Local-only mode still behaves correctly when offline or signed out
- Query performance remains acceptable after RLS is enabled

## Migration Strategy

Suggested order:

1. Add `user_id` as nullable
2. Backfill development data
3. Create index on `user_id`
4. Enable RLS and add policies
5. Update client to send `user_id` and require auth
6. Mark `user_id` as `not null`
7. Remove or replace unnecessary indexes

This order reduces the chance of breaking existing development data while the client and database are being aligned.

## Open Decisions

These need explicit implementation-time decisions:

1. Authentication UX: whether sync is opt-in at sign-in time or automatic
2. Local data claiming: whether pre-auth local todos should be merged, reassigned, or kept separate
3. Soft delete policy: whether deleted rows remain queryable only by owner for conflict resolution
4. Future server boundary: whether complex writes should remain direct browser upserts or move to RPC

## Acceptance Criteria

- `todos` has an indexed `user_id` ownership column
- RLS is enabled and forced in migrations
- Policies restrict access to the authenticated owner only
- The browser client uses only the anon/publishable key
- Remote sync requires an authenticated user
- Existing offline-local behavior remains intact
- The new security model is documented in the codebase

## Implementation Checklist

- [ ] Update Drizzle schema with `user_id`
- [ ] Generate and review migration SQL
- [ ] Add RLS enable/force statements
- [ ] Add select/insert/update/delete policies
- [ ] Update Supabase client env validation
- [ ] Add auth-aware cloud sync gating
- [ ] Send `user_id` in remote writes
- [ ] Revisit indexes after policy changes
- [ ] Test authorized and unauthorized write/read paths
- [ ] Update setup docs for required env vars and auth assumptions

## Follow-Up

Once implementation starts, create a second document or task breakdown for:

- exact migration SQL
- client auth flow changes
- test coverage for RLS behavior
- rollout/backfill steps for any existing hosted data
