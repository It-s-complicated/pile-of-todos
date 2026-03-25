import { computed, ref, watch } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'

import {
  electricTodosCollection,
  getActiveCollection,
  getCurrentDeviceId,
  getGuestCollection,
  isElectricConfigured,
} from '@/db/collections'
import type { Todo } from '@/db/collections'
import { shouldShowGuestClaimPrompt } from '@/lib/auth-allowlist'
import { getSupabaseClient, setSupabaseAuthError } from '@/lib/supabase'
import { claimGuestTodos } from '@/lib/todo-storage'
import { buildRemoteTodoRow, shouldPushTodoForUser } from '@/lib/todo-sync'
import { useAuth } from './useAuth'
import { useNetworkStatus } from './useNetworkStatus'

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local-only' | 'stale'

function normalizeTodo(todo: Todo): Todo {
  return {
    ...todo,
    userId: todo.userId ?? null,
    deletedAt: todo.deletedAt ?? null,
  }
}

function isSameTodo(left: Todo, right: Todo): boolean {
  return (
    left.label === right.label &&
    left.weekNumber === right.weekNumber &&
    left.done === right.done &&
    left.archived === right.archived &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.deviceId === right.deviceId &&
    left.userId === right.userId &&
    left.deletedAt === right.deletedAt
  )
}

function shouldRemoteWin(localTodo: Todo, remoteTodo: Todo) {
  return (
    remoteTodo.updatedAt > localTodo.updatedAt ||
    (remoteTodo.updatedAt === localTodo.updatedAt && !isSameTodo(remoteTodo, localTodo))
  )
}

function needsRemoteWrite(localTodo: Todo, remoteTodo: Todo | undefined) {
  if (!remoteTodo) {
    return true
  }

  return localTodo.updatedAt > remoteTodo.updatedAt
}

function getTodoFingerprint(todos: Todo[]) {
  return todos
    .map((todo) => `${todo.id}:${todo.updatedAt}:${todo.deletedAt ?? 'active'}`)
    .join('|')
}

export function useElectricTodos() {
  const { isOnline } = useNetworkStatus()
  const {
    accessState,
    isAuthReady,
    isAuthenticated,
    signOut,
    userId: authenticatedUserId,
  } = useAuth()
  const isSyncing = ref(false)
  const isRemoteReady = ref(false)
  const hasSyncedOnce = ref(false)
  const syncError = ref(false)
  const lastSyncedAt = ref<number | null>(null)
  const isApplyingRemote = ref(false)
  const syncQueued = ref(false)
  const handledClaimPromptUserIds = ref<string[]>([])
  let lastPushedFingerprint = ''
  const isElectricEnabled = isElectricConfigured()

  const activeUserId = computed(() =>
    accessState.value === 'approved' ? authenticatedUserId.value : null,
  )
  const activeLocalCollection = computed(() => getActiveCollection(activeUserId.value))
  const guestTodosCollection = getGuestCollection()

  const { data: localTodos, isReady } = useLiveQuery(
    (q) => q.from({ todo: activeLocalCollection.value }).select(({ todo }) => todo),
    [activeLocalCollection],
  )
  const { data: guestTodos } = useLiveQuery((q) =>
    q.from({ todo: guestTodosCollection }).select(({ todo }) => todo),
  )
  const { data: remoteTodos, isReady: isRemoteQueryReady } = useLiveQuery((q) =>
    q.from({ todo: electricTodosCollection }).select(({ todo }) => todo),
  )

  const localSnapshot = computed(() => (localTodos.value ?? []).map((todo) => normalizeTodo(todo)))
  const guestSnapshot = computed(() => (guestTodos.value ?? []).map((todo) => normalizeTodo(todo)))
  const remoteSnapshot = computed(() =>
    (remoteTodos.value ?? []).map((todo) => normalizeTodo(todo)),
  )
  const scopedRemoteSnapshot = computed(() =>
    remoteSnapshot.value.filter((todo) => todo.userId === activeUserId.value),
  )
  const guestTodoCount = computed(
    () => guestSnapshot.value.filter((todo) => todo.deletedAt === null).length,
  )
  const hasHandledClaimPrompt = computed(() =>
    activeUserId.value === null
      ? false
      : handledClaimPromptUserIds.value.includes(activeUserId.value),
  )
  const claimPromptVisible = computed(() =>
    shouldShowGuestClaimPrompt({
      isAuthenticated: isAuthenticated.value && accessState.value === 'approved',
      guestTodoCount: guestTodoCount.value,
      hasHandledClaimPrompt: hasHandledClaimPrompt.value,
    }),
  )

  const localTodosCount = computed(() => localSnapshot.value.length)
  const localSyncFingerprint = computed(() => getTodoFingerprint(localSnapshot.value))
  const remoteSyncFingerprint = computed(() => getTodoFingerprint(scopedRemoteSnapshot.value))
  const canSync = computed(
    () =>
      isElectricEnabled &&
      isOnline.value &&
      activeUserId.value !== null &&
      !claimPromptVisible.value,
  )
  const canSyncWithRemote = computed(() => canSync.value && isRemoteReady.value)
  const syncActivationKey = computed(() => (canSync.value ? activeUserId.value : null))
  const shouldMarkRemoteReady = computed(() => canSync.value && isRemoteQueryReady.value)
  const remoteSyncTrigger = computed(() =>
    canSyncWithRemote.value && activeUserId.value
      ? `${activeUserId.value}:${remoteSyncFingerprint.value}`
      : null,
  )
  const localSyncTrigger = computed(() =>
    canSync.value && !isApplyingRemote.value && activeUserId.value
      ? `${activeUserId.value}:${localSyncFingerprint.value}`
      : null,
  )

  function applyRemoteTodoToLocal(todo: Todo) {
    const collection = activeLocalCollection.value
    const existing = collection.get(todo.id)

    if (!existing) {
      collection.insert(todo)
      return
    }

    collection.update(todo.id, (draft) => {
      draft.label = todo.label
      draft.weekNumber = todo.weekNumber
      draft.done = todo.done
      draft.archived = todo.archived
      draft.createdAt = todo.createdAt
      draft.updatedAt = todo.updatedAt
      draft.deviceId = todo.deviceId
      draft.userId = todo.userId
      draft.deletedAt = todo.deletedAt
    })
  }

  function getPendingLocalTodos(localTodosToCheck: Todo[], remoteTodosToCompare: Todo[]) {
    const remoteById = new Map(remoteTodosToCompare.map((todo) => [todo.id, todo]))

    return localTodosToCheck.filter((todo) => {
      if (!shouldPushTodoForUser(todo, activeUserId.value)) {
        return false
      }

      return needsRemoteWrite(todo, remoteById.get(todo.id))
    })
  }

  const needsSync = computed(() => {
    if (!canSync.value) {
      return false
    }

    if (syncError.value) {
      return true
    }

    if (!isRemoteReady.value) {
      return true
    }

    return getPendingLocalTodos(localSnapshot.value, scopedRemoteSnapshot.value).length > 0
  })

  const syncStatus = computed<SyncStatus>(() => {
    if (!isOnline.value || !isElectricEnabled || !activeUserId.value || !isAuthReady.value) {
      return 'local-only'
    }

    if (claimPromptVisible.value) {
      return 'local-only'
    }

    if (isSyncing.value || !isRemoteReady.value) {
      return 'syncing'
    }

    if (syncError.value) {
      return hasSyncedOnce.value ? 'stale' : 'error'
    }

    if (needsSync.value) {
      return 'syncing'
    }

    return hasSyncedOnce.value ? 'synced' : 'syncing'
  })

  function getPushFingerprint(localTodosToPush: Todo[]) {
    return localTodosToPush
      .map((todo) => `${todo.id}:${todo.updatedAt}:${todo.deletedAt ?? 'active'}`)
      .join('|')
  }

  async function pushLocalTodos(localTodosToPush: Todo[]) {
    const pushableTodos = localTodosToPush.filter((todo) =>
      shouldPushTodoForUser(todo, activeUserId.value),
    )

    if (pushableTodos.length === 0) {
      return false
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Cloud sync is not configured: missing Supabase credentials')
    }

    const pushFingerprint = getPushFingerprint(pushableTodos)
    if (pushFingerprint === lastPushedFingerprint) {
      return false
    }

    const { error } = await supabase.from('todos').upsert(
      pushableTodos.map((todo) => buildRemoteTodoRow(todo, getCurrentDeviceId())),
      {
        onConflict: 'id',
      },
    )

    if (error) {
      throw new Error(error.message)
    }

    lastPushedFingerprint = pushFingerprint
    return true
  }

  async function reconcileRemoteTodos(remoteTodosToApply: Todo[]) {
    const localById = new Map(localSnapshot.value.map((todo) => [todo.id, todo]))
    let changed = false

    isApplyingRemote.value = true
    try {
      for (const remoteTodo of remoteTodosToApply) {
        const localTodo = localById.get(remoteTodo.id)

        if (!localTodo) {
          applyRemoteTodoToLocal(remoteTodo)
          changed = true
          continue
        }

        if (shouldRemoteWin(localTodo, remoteTodo)) {
          applyRemoteTodoToLocal(remoteTodo)
          changed = true
        }
      }
    } finally {
      isApplyingRemote.value = false
    }

    return changed
  }

  async function syncTodos(): Promise<boolean> {
    if (
      !isOnline.value ||
      !isElectricEnabled ||
      !activeUserId.value ||
      claimPromptVisible.value
    ) {
      return false
    }

    if (isSyncing.value) {
      syncQueued.value = true
      return false
    }

    isSyncing.value = true
    syncError.value = false

    try {
      if (isRemoteQueryReady.value) {
        isRemoteReady.value = true
      }

      await reconcileRemoteTodos(scopedRemoteSnapshot.value)
      const pendingLocalTodos = getPendingLocalTodos(
        localSnapshot.value,
        scopedRemoteSnapshot.value,
      )

      await pushLocalTodos(pendingLocalTodos)

      hasSyncedOnce.value = true
      lastSyncedAt.value = Date.now()
      syncError.value = false
      return getPendingLocalTodos(localSnapshot.value, scopedRemoteSnapshot.value).length === 0
    } catch (error) {
      console.error('Sync failed:', error)
      syncError.value = true
      return false
    } finally {
      isSyncing.value = false

      if (syncQueued.value) {
        syncQueued.value = false
        void syncTodos()
      }
    }
  }

  function markClaimPromptHandled(userId: string) {
    if (!handledClaimPromptUserIds.value.includes(userId)) {
      handledClaimPromptUserIds.value = [...handledClaimPromptUserIds.value, userId]
    }
  }

  async function claimGuestTodosToAccount(): Promise<boolean> {
    if (!activeUserId.value) {
      return false
    }

    const guestTodosToClaim = guestSnapshot.value.filter((todo) => todo.deletedAt === null)
    if (guestTodosToClaim.length > 0) {
      activeLocalCollection.value.insert(
        claimGuestTodos(guestTodosToClaim, activeUserId.value, Date.now()),
      )
      guestTodosCollection.delete(guestTodosToClaim.map((todo) => todo.id))
    }

    markClaimPromptHandled(activeUserId.value)

    if (isOnline.value && isElectricEnabled) {
      await syncTodos()
    }

    return true
  }

  async function keepGuestTodosSeparate(): Promise<boolean> {
    if (!activeUserId.value) {
      return false
    }

    markClaimPromptHandled(activeUserId.value)

    if (isOnline.value && isElectricEnabled) {
      await syncTodos()
    }

    return true
  }

  function addTodo(label: string, weekNumber: number | null): string {
    const id = crypto.randomUUID()
    const now = Date.now()

    activeLocalCollection.value.insert({
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deviceId: getCurrentDeviceId(),
      userId: activeUserId.value,
      deletedAt: null,
    })

    return id
  }

  function updateTodo(id: string, updates: Partial<Omit<Todo, 'id'>>): void {
    activeLocalCollection.value.update(id, (draft) => {
      Object.assign(draft, updates, {
        updatedAt: Date.now(),
        deviceId: getCurrentDeviceId(),
      })
    })
  }

  function deleteTodo(id: string): void {
    updateTodo(id, { deletedAt: Date.now() })
  }

  function toggleTodoDone(id: string): void {
    const todo = localSnapshot.value.find((item) => item.id === id)
    if (todo && todo.deletedAt === null) {
      updateTodo(id, { done: !todo.done })
    }
  }

  function archiveTodo(id: string): void {
    updateTodo(id, { archived: true })
  }

  watch(
    () => activeUserId.value,
    () => {
      lastPushedFingerprint = ''
      isRemoteReady.value = false
      syncError.value = false
      hasSyncedOnce.value = false
      lastSyncedAt.value = null
      syncQueued.value = false
    },
  )

  watch(
    () => accessState.value,
    (nextAccessState) => {
      if (nextAccessState !== 'denied') {
        return
      }

      setSupabaseAuthError('This GitHub account is not approved for sync access.')
      void signOut()
    },
  )

  watch(
    () => shouldMarkRemoteReady.value,
    (shouldMarkReady) => {
      if (shouldMarkReady) {
        isRemoteReady.value = true
      }
    },
    { immediate: true },
  )

  watch(
    () => syncActivationKey.value,
    (key) => {
      if (key) {
        void syncTodos()
      }
    },
    { immediate: true },
  )

  watch(
    () => remoteSyncTrigger.value,
    (trigger) => {
      if (!trigger) {
        return
      }

      lastPushedFingerprint = ''
      void syncTodos()
    },
  )

  watch(
    () => localSyncTrigger.value,
    (trigger) => {
      if (!trigger) {
        return
      }

      void syncTodos()
    },
  )

  return {
    todos: localSnapshot,
    isOnline,
    isReady,
    isMigrating: computed(() => isSyncing.value),
    syncStatus,
    localTodosCount,
    guestTodoCount,
    claimPromptVisible,
    lastSyncedAt: computed(() => lastSyncedAt.value),
    needsSync,
    needsMigration: needsSync,
    isElectricEnabled,
    syncTodos,
    claimGuestTodos: claimGuestTodosToAccount,
    keepGuestTodosSeparate,
    migrateLocalTodos: syncTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodoDone,
    archiveTodo,
  }
}
