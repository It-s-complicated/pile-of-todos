# GitHub Auth Single-User Sync Design

**Date:** 2026-03-14

## Goal

Add an in-app Supabase GitHub auth flow that only permits one approved GitHub identity, keeps signed-out and signed-in local data isolated, and automatically offers to claim guest todos into the approved account before sync starts.

## Scope

This design covers:

- in-app GitHub sign-in and sign-out
- server-side allowlist enforcement in Supabase
- guest vs account-local storage partitioning
- guest todo claim flow after sign-in
- authenticated sync startup and sign-out behavior

This design does not cover:

- multi-user collaboration
- password or magic-link auth
- admin UI for changing the allowlist

## Architecture

The app remains frontend-only and continues to use Supabase Auth, Supabase writes, Electric reads, and TanStack DB local persistence. The new auth surface lives in the app header and drives a small auth state layer in the frontend. Remote sync remains available only for an authenticated session.

Supabase enforces the single approved user with a `before-user-created` auth hook backed by a seeded Postgres allowlist table. The allowlist stores the approved GitHub OAuth `provider_id`, which is more stable than email for this use case. App-side checks remain as defense in depth, but the database-side hook is the source of truth.

Local persistence is partitioned into:

- a guest bucket used while signed out
- an account bucket keyed by the authenticated Supabase user id

The active bucket changes with auth state. Signing out switches the app back to the guest bucket without deleting the account bucket. Signing back in restores the account bucket.

## Data Flow

### Signed Out

- App uses the guest local bucket.
- New todos are stored with `userId = null`.
- Remote sync is disabled.

### Sign In

- User clicks `Sign in with GitHub`.
- Supabase OAuth redirects back into the app.
- App restores the session and switches to the authenticated account bucket.
- If guest todos exist, app prompts the user to claim and sync them.
- If the user confirms, guest todos are moved into the account bucket and rewritten with the authenticated `userId`.
- Sync starts automatically after the claim flow completes.

### Signed In

- New todos, edits, imports, and deletes operate in the account bucket.
- Account bucket writes always include the authenticated `userId`.
- Electric reads and Supabase writes are scoped to the same user.

### Sign Out

- App signs out from Supabase.
- Active bucket switches back to the guest bucket.
- Account-local cache remains stored for the next sign-in.
- Sync stops immediately.

## Error Handling

- If GitHub sign-in succeeds but the user is not allowlisted, Supabase should reject creation via the auth hook.
- If a non-allowlisted existing auth user somehow reaches the app, the app should sign them out and show an access denied message.
- If guest todo claim fails, guest data must remain intact and sync must not partially start.
- If sync fails after claim, claimed rows stay in the account bucket and the existing retry UX handles the failure.

## Rollout

- Create and seed the allowlist table before enabling public sign-in.
- Backfill existing hosted `todos.user_id` for the approved account before relying on the new RLS flow.
- Keep `user_id` nullable temporarily only to support rollout of existing hosted data.
- Add a follow-up migration to make `todos.user_id` `NOT NULL` after backfill is verified.

## Testing

- auth UI state: signed out, signed in, denied user
- bucket selection: guest bucket vs account bucket
- claim flow: guest todos move into the account bucket with the authenticated `userId`
- write entry points: create/import assign ownership correctly
- sign-out and sign-in isolation: one account never sees another account's local bucket
- sync gating: signed-out mode never syncs, approved signed-in mode auto-syncs
