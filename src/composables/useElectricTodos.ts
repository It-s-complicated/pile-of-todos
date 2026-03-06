import { computed, ref, watch } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'
import {
  electricTodosCollection,
  getCurrentDeviceId,
  isElectricConfigured,
  localTodosCollection,
  type Todo,
} from '@/db/collections'
import { getSupabaseClient } from '@/lib/supabase'
import { useNetworkStatus } from './useNetworkStatus'

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local-only' | 'stale'

function toRemoteRow(todo: Todo) {
  return {
    id: todo.id,
    label: todo.label,
    week_number: todo.weekNumber,
    done: todo.done,
    archived: todo.archived,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    device_id: todo.deviceId || getCurrentDeviceId(),
    deleted_at: todo.deletedAt,
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
    left.deletedAt === right.deletedAt
  )
}

function shouldRemoteWin(localTodo: Todo, remoteTodo: Todo) {
  return (
    remoteTodo.updatedAt > localTodo.updatedAt ||
    (remoteTodo.updatedAt === localTodo.updatedAt && !isSameTodo(remoteTodo, localTodo))
  )
}

function applyRemoteTodoToLocal(todo: Todo) {
  const existing = localTodosCollection.get(todo.id)

  if (!existing) {
    localTodosCollection.insert(todo)
    return
  }

  localTodosCollection.update(todo.id, (draft) => {
    draft.label = todo.label
    draft.weekNumber = todo.weekNumber
    draft.done = todo.done
    draft.archived = todo.archived
    draft.createdAt = todo.createdAt
    draft.updatedAt = todo.updatedAt
    draft.deviceId = todo.deviceId
    draft.deletedAt = todo.deletedAt
  })
}

function needsRemoteWrite(localTodo: Todo, remoteTodo: Todo | undefined) {
  if (!remoteTodo) {
    return true
  }

  return localTodo.updatedAt > remoteTodo.updatedAt
}

export function useElectricTodos() {
  const { isOnline } = useNetworkStatus()
  const isSyncing = ref(false)
  const isRemoteReady = ref(false)
  const hasSyncedOnce = ref(false)
  const syncError = ref(false)
  const lastSyncedAt = ref<number | null>(null)
  const isApplyingRemote = ref(false)
  const syncQueued = ref(false)
  let lastPushedFingerprint = ''

  const { data: localTodos, isReady } = useLiveQuery((q) => q.from({ todo: localTodosCollection }))
  const { data: remoteTodos, isReady: isRemoteQueryReady } = useLiveQuery((q) =>
    q.from({ todo: electricTodosCollection }),
  )

  const localSnapshot = computed(() => localTodos.value ?? [])
  const remoteSnapshot = computed(() => remoteTodos.value ?? [])

  const localTodosCount = computed(() => Array.from(localTodosCollection.entries()).length)

  function getPendingLocalTodos(localTodosToCheck: Todo[], remoteTodosToCompare: Todo[]) {
    const remoteById = new Map(remoteTodosToCompare.map((todo) => [todo.id, todo]))
    return localTodosToCheck.filter((todo) => needsRemoteWrite(todo, remoteById.get(todo.id)))
  }

  const needsSync = computed(() => {
    if (!isElectricConfigured() || !isOnline.value) {
      return false
    }

    if (syncError.value) {
      return true
    }

    if (!isRemoteReady.value) {
      return true
    }

    return getPendingLocalTodos(localSnapshot.value, remoteSnapshot.value).length > 0
  })

  const syncStatus = computed<SyncStatus>(() => {
    if (!isElectricConfigured() || !isOnline.value) {
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
    return localTodosToPush.map((todo) => `${todo.id}:${todo.updatedAt}:${todo.deletedAt ?? 'active'}`).join('|')
  }

  async function pushLocalTodos(localTodosToPush: Todo[]) {
    if (localTodosToPush.length === 0) {
      return false
    }

    const supabase = getSupabaseClient()

    if (!supabase) {
      throw new Error('Cloud sync is not configured: missing Supabase credentials')
    }

    const pushFingerprint = getPushFingerprint(localTodosToPush)

    if (pushFingerprint === lastPushedFingerprint) {
      return false
    }

    const { error } = await supabase.from('todos').upsert(localTodosToPush.map(toRemoteRow), {
      onConflict: 'id',
    })

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
    if (!isOnline.value || !isElectricConfigured()) {
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

      await reconcileRemoteTodos(remoteSnapshot.value)
      const pendingLocalTodos = getPendingLocalTodos(localSnapshot.value, remoteSnapshot.value)

      await pushLocalTodos(pendingLocalTodos)

      hasSyncedOnce.value = true
      lastSyncedAt.value = Date.now()
      syncError.value = false
      return getPendingLocalTodos(localSnapshot.value, remoteSnapshot.value).length === 0
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

  function addTodo(label: string, weekNumber: number | null): string {
    const id = crypto.randomUUID()
    const now = Date.now()

    localTodosCollection.insert({
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deviceId: getCurrentDeviceId(),
      deletedAt: null,
    })

    return id
  }

  function updateTodo(id: string, updates: Partial<Omit<Todo, 'id'>>): void {
    localTodosCollection.update(id, (draft) => {
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
    () => isOnline.value,
    (online) => {
      if (online && isElectricConfigured()) {
        void syncTodos()
      }
    },
    { immediate: true },
  )

  watch(
    () => isRemoteQueryReady.value,
    (ready) => {
      if (ready) {
        isRemoteReady.value = true
      }
    },
    { immediate: true },
  )

  watch(
    () =>
      remoteSnapshot.value
        .map((todo) => `${todo.id}:${todo.updatedAt}:${todo.deletedAt ?? 'active'}`)
        .join('|'),
    () => {
      if (!isElectricConfigured() || !isOnline.value || !isRemoteReady.value) {
        return
      }

      lastPushedFingerprint = ''
      void syncTodos()
    },
  )

  watch(
    () =>
      localSnapshot.value
        ?.map((todo) => `${todo.id}:${todo.updatedAt}:${todo.deletedAt ?? 'active'}`)
        .join('|') ?? '',
    () => {
      if (!isElectricConfigured() || !isOnline.value || isApplyingRemote.value) {
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
    lastSyncedAt: computed(() => lastSyncedAt.value),
    needsSync,
    needsMigration: needsSync,
    isElectricEnabled: isElectricConfigured(),
    syncTodos,
    migrateLocalTodos: syncTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodoDone,
    archiveTodo,
  }
}
