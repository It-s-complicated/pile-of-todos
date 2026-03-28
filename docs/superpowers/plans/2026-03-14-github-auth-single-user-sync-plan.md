# GitHub Auth Single-User Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app Supabase GitHub auth flow restricted to one approved GitHub identity, isolate guest and account-local caches, and automatically claim guest todos into the approved account before authenticated sync starts.

**Architecture:** The app keeps Supabase Auth in the frontend, but authorization is enforced on the Supabase side with a seeded allowlist table plus a `before-user-created` auth hook keyed on the GitHub OAuth `provider_id`. Frontend local persistence is split into a guest bucket and per-account buckets keyed by Supabase user id, and sync runs only against the authenticated account bucket after any guest-claim step completes.

**Tech Stack:** Vue 3 Composition API, TypeScript, TanStack DB, LocalStorage, Supabase Auth, Supabase Postgres, Electric SQL, Drizzle migrations, Node test runner.

---

## File Map

- Create: `src/components/AuthStatus.vue`
  Shows signed-out vs signed-in state, sign-in button, sign-out button, and allowlist/auth errors.
- Create: `src/composables/useAuth.ts`
  Wraps Supabase auth actions and exposes app-ready auth state for UI and sync.
- Create: `src/lib/todo-storage.ts`
  Centralizes guest/account storage-key derivation and active bucket selection.
- Create: `src/lib/auth-allowlist.ts`
  Holds small pure helpers for allowlist decisions and claim prompt state.
- Create: `src/lib/auth-allowlist.test.ts`
  Unit tests for allowlist and bucket helpers.
- Create: `src/lib/todo-storage.test.ts`
  Unit tests for storage-key and guest/account migration helpers.
- Create: `src/db/out/0003_github_auth_allowlist.sql`
  Allowlist table, seed row, auth-hook SQL, and any helper functions needed for Supabase-side enforcement.
- Modify: `src/App.vue`
  Replace direct todo creation path with auth-aware collection access and add auth UI.
- Modify: `src/lib/supabase.ts`
  Add GitHub sign-in/sign-out helpers and auth-state wiring needed by the app.
- Modify: `src/db/collections.ts`
  Replace the single hard-coded local storage key with guest/account bucket selection.
- Modify: `src/composables/useElectricTodos.ts`
  Switch from a single local collection to the active bucket, add claim/start-sync orchestration, and stop sync on sign-out.
- Modify: `src/composables/useDataExport.ts`
  Ensure imports go into the active bucket and set ownership correctly for the signed-in user.
- Modify: `src/components/SyncStatus.vue`
  Keep sync status coherent with auth state and claim flow.
- Modify: `src/env.d.ts`
  Add frontend env typing for the approved GitHub provider id if the UI needs it for diagnostics.
- Modify: `README.md`
  Document GitHub auth setup, allowlist seeding, auth hook registration, and the guest-claim flow.
- Test: `npm run test`
- Test: `npm run lint`
- Test: `npm run fmt:check`
- Test: `npm run build`

## Chunk 1: Auth Surface And Supabase Wiring

### Task 1: Add pure auth helpers and tests

**Files:**
- Create: `src/lib/auth-allowlist.ts`
- Create: `src/lib/auth-allowlist.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- approved GitHub identity detection by `provider_id`
- denied-user state mapping
- claim prompt visibility rules

Run: `node --test --experimental-strip-types src/lib/auth-allowlist.test.ts`
Expected: FAIL because the file or exports do not exist yet.

- [ ] **Step 2: Write minimal helper implementation**

Implement pure helpers such as:
- `isApprovedGithubIdentity(...)`
- `shouldShowGuestClaimPrompt(...)`
- `getAuthAccessState(...)`

- [ ] **Step 3: Run the helper tests**

Run: `node --test --experimental-strip-types src/lib/auth-allowlist.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-allowlist.ts src/lib/auth-allowlist.test.ts
git commit -m "test: add auth allowlist helpers"
```

### Task 2: Add frontend auth composable and Supabase actions

**Files:**
- Create: `src/composables/useAuth.ts`
- Modify: `src/lib/supabase.ts`
- Test: `src/lib/auth-allowlist.test.ts`

- [ ] **Step 1: Write the failing test or harness check**

Extend helper tests or add a narrow unit test for session-to-auth-state mapping if practical. If a direct composable test is too expensive in the current setup, test the pure state mapping helpers first and document that the UI path is covered in later integration verification.

Run: `npm run test`
Expected: FAIL with missing auth state helpers or wrong session handling.

- [ ] **Step 2: Implement minimal auth API**

Add to `src/lib/supabase.ts`:
- `signInWithGithub()`
- `signOut()`
- redirect/session restoration helpers

Add `src/composables/useAuth.ts` to expose:
- `session`
- `user`
- `isAuthenticated`
- `isAuthReady`
- `authError`
- `signInWithGithub`
- `signOut`

- [ ] **Step 3: Verify tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts src/composables/useAuth.ts src/lib/auth-allowlist.test.ts
git commit -m "feat: add frontend auth state"
```

### Task 3: Add auth UI

**Files:**
- Create: `src/components/AuthStatus.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Write the failing UI assertion plan**

Add a short test note or TODO harness comment describing manual verification:
- signed out shows `Sign in with GitHub`
- signed in shows user identity and `Sign out`
- denied user shows access denied message

If a Vue component test harness is introduced in the same session, write the failing component test first instead.

- [ ] **Step 2: Implement the minimal UI**

Add a small auth widget in the header. Do not entangle it with todo creation logic yet beyond showing state and actions.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: PASS

Manual check:
- launch app
- confirm auth widget renders in both signed-out and signed-in states

- [ ] **Step 4: Commit**

```bash
git add src/components/AuthStatus.vue src/App.vue
git commit -m "feat: add github auth ui"
```

## Chunk 2: Bucketed Local Storage And Ownership

### Task 4: Add bucket helpers and tests

**Files:**
- Create: `src/lib/todo-storage.ts`
- Create: `src/lib/todo-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- guest storage key
- authenticated account storage key by user id
- stable switching between guest and account keys
- guest-to-account claim transform assigning `userId`

Run: `node --test --experimental-strip-types src/lib/todo-storage.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement minimal storage helpers**

Implement helpers such as:
- `getGuestStorageKey()`
- `getAccountStorageKey(userId: string)`
- `getActiveStorageKey(userId: string | null)`
- `claimGuestTodos(todos, userId, now)`

- [ ] **Step 3: Verify tests**

Run: `node --test --experimental-strip-types src/lib/todo-storage.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/todo-storage.ts src/lib/todo-storage.test.ts
git commit -m "test: add bucket storage helpers"
```

### Task 5: Replace the single local bucket with guest/account buckets

**Files:**
- Modify: `src/db/collections.ts`
- Modify: `src/composables/useElectricTodos.ts`
- Modify: `src/App.vue`
- Modify: `src/composables/useTodos.ts`

- [ ] **Step 1: Write the failing regression tests**

Add helper-level tests for active storage-key selection. If the project gains a composable test harness in this session, add a regression test that a signed-in user does not read guest rows by default.

Run: `npm run test`
Expected: FAIL

- [ ] **Step 2: Implement active collection selection**

In `src/db/collections.ts`:
- stop hard-coding `ai-todo-app-todos`
- create guest/account collection instances from storage-key helpers
- expose a way to resolve the active collection from auth state

In `src/composables/useElectricTodos.ts` and `src/App.vue`:
- stop inserting directly into the fixed guest/shared bucket
- route all writes through the auth-aware active collection

- [ ] **Step 3: Verify**

Run: `npm run test`
Expected: PASS

Manual check:
- create a guest todo
- sign in
- confirm the guest todo is not silently shown in the account bucket before claim

- [ ] **Step 4: Commit**

```bash
git add src/db/collections.ts src/composables/useElectricTodos.ts src/App.vue src/composables/useTodos.ts
git commit -m "feat: partition local todo storage by account"
```

### Task 6: Claim guest todos after sign-in

**Files:**
- Modify: `src/composables/useElectricTodos.ts`
- Modify: `src/components/SyncStatus.vue`
- Modify: `src/App.vue`
- Test: `src/lib/todo-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Add a helper test that guest todos are transformed into account-owned todos with the authenticated `userId`.

Run: `npm run test`
Expected: FAIL if the claim helper or orchestration is incomplete.

- [ ] **Step 2: Implement the claim flow**

Add logic to:
- detect guest todos on successful sign-in
- show a one-time confirmation prompt
- move claimed todos into the account bucket
- preserve guest bucket when claim is declined
- start sync automatically after a successful claim

- [ ] **Step 3: Verify**

Run: `npm run test`
Expected: PASS

Manual check:
- create guest todos
- sign in
- accept claim prompt
- confirm claimed rows appear in the account bucket with sync starting automatically

- [ ] **Step 4: Commit**

```bash
git add src/composables/useElectricTodos.ts src/components/SyncStatus.vue src/App.vue src/lib/todo-storage.test.ts
git commit -m "feat: claim guest todos into authenticated account"
```

## Chunk 3: Supabase Allowlist Enforcement And Sync Integration

### Task 7: Add Supabase-side allowlist enforcement

**Files:**
- Create: `src/db/out/0003_github_auth_allowlist.sql`
- Modify: `README.md`

- [ ] **Step 1: Write the migration SQL**

Create SQL for:
- allowlist table for approved GitHub `provider_id`
- seed row insertion placeholder
- helper function used by auth hook
- `before-user-created` hook function that rejects non-approved GitHub users

- [ ] **Step 2: Review SQL against Supabase docs**

Confirm the hook contract and allowlist lookup match Supabase Auth Hook requirements before proceeding.

- [ ] **Step 3: Document setup**

In `README.md`, document:
- GitHub provider setup in Supabase
- allowlist seed requirements
- hook registration steps
- the fact that the approved GitHub `provider_id` is the source of truth

- [ ] **Step 4: Commit**

```bash
git add src/db/out/0003_github_auth_allowlist.sql README.md
git commit -m "feat: add github allowlist auth hook"
```

### Task 8: Finish ownership on all write entry points

**Files:**
- Modify: `src/App.vue`
- Modify: `src/composables/useDataExport.ts`
- Modify: `src/composables/useElectricTodos.ts`
- Test: `src/lib/todo-sync.test.ts`

- [ ] **Step 1: Write the failing regression test**

Add or extend tests so they fail when:
- signed-in create flow does not set `userId`
- import into an authenticated bucket does not assign the authenticated `userId`

Run: `npm run test`
Expected: FAIL

- [ ] **Step 2: Implement minimal ownership fixes**

Ensure:
- authenticated create writes always carry current `userId`
- authenticated import rewrites imported rows to current `userId`
- guest import keeps `userId = null`

- [ ] **Step 3: Verify**

Run: `npm run test`
Expected: PASS

Manual check:
- import a file while signed in
- confirm imported rows become owned by the current account and start syncing

- [ ] **Step 4: Commit**

```bash
git add src/App.vue src/composables/useDataExport.ts src/composables/useElectricTodos.ts src/lib/todo-sync.test.ts
git commit -m "fix: assign ownership on all todo write paths"
```

### Task 9: Tighten sync lifecycle around auth changes

**Files:**
- Modify: `src/composables/useElectricTodos.ts`
- Modify: `src/components/SyncStatus.vue`
- Modify: `src/components/AuthStatus.vue`

- [ ] **Step 1: Write the failing regression checklist**

Document or codify the expected transitions:
- signed out => local only
- signed in approved => auto sync starts
- sign out => sync stops and guest bucket becomes active
- sign back in => account cache is restored

- [ ] **Step 2: Implement lifecycle guards**

Ensure:
- sync never runs while signed out
- denied-user state signs out and stops sync
- account cache is retained across sign-out/sign-in
- stale remote snapshot data cannot leak across account changes

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: PASS

Manual check:
- sign in as approved user
- sign out
- confirm guest bucket is active
- sign in again
- confirm prior account-local cache is restored

- [ ] **Step 4: Commit**

```bash
git add src/composables/useElectricTodos.ts src/components/SyncStatus.vue src/components/AuthStatus.vue
git commit -m "fix: align sync lifecycle with auth state"
```

## Chunk 4: Rollout Safety, Verification, And Docs

### Task 10: Backfill and rollout documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/SUPABASE-WRITE-HARDENING-PLAN.md`

- [ ] **Step 1: Document the rollout order**

Describe:
- seed allowlist
- register auth hook
- backfill existing hosted `todos.user_id` for the approved account
- verify RLS and sync
- later add `NOT NULL`

- [ ] **Step 2: Add operational notes**

Include:
- how to obtain the approved GitHub `provider_id`
- how to validate the auth hook in Supabase
- how to verify existing hosted rows are backfilled before enabling the flow

- [ ] **Step 3: Commit**

```bash
git add README.md docs/SUPABASE-WRITE-HARDENING-PLAN.md
git commit -m "docs: add auth rollout and backfill plan"
```

### Task 11: Final verification

**Files:**
- Test only

- [ ] **Step 1: Run unit and helper tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Run format check**

Run: `npm run fmt:check`
Expected: PASS

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Run manual auth verification**

Verify:
- approved GitHub sign-in works
- guest claim prompt appears and claimed todos sync
- denied user cannot remain signed in
- sign-out returns to guest bucket
- approved user cache survives sign-out/sign-in

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: verify github auth single-user sync flow"
```

