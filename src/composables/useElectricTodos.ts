import { computed, ref, watch } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'
import {
  getCurrentDeviceId,
  isElectricConfigured,
  localTodosCollection,
  type Todo,
} from '@/db/collections'
import { getSupabaseClient } from '@/lib/supabase'
import { useNetworkStatus } from './useNetworkStatus'

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local-only'

type RemoteTodoRow = {
  id: string
  label: string
  week_number: number | null
  done: boolean
  archived: boolean
  created_at: number | string
  updated_at: number | string
  device_id: string | null
}

export function useElectricTodos() {
  const { isOnline } = useNetworkStatus()
  const isMigrating = ref(false)
  const hasSyncedOnce = ref(false)
  const syncError = ref(false)

  // Always query local collection so data is available offline.
  const { data: todos, isReady } = useLiveQuery((q) => q.from({ todo: localTodosCollection }))

  const syncStatus = computed<SyncStatus>(() => {
    if (!isElectricConfigured() || !isOnline.value) {
      return 'local-only'
    }

    if (syncError.value) {
      return 'error'
    }

    if (isMigrating.value) {
      return 'syncing'
    }

    return isReady.value ? 'synced' : 'syncing'
  })

  function toDbRow(todo: Todo) {
    return {
      id: todo.id,
      label: todo.label,
      week_number: todo.weekNumber,
      done: todo.done,
      archived: todo.archived,
      created_at: todo.createdAt,
      updated_at: todo.updatedAt,
      device_id: todo.deviceId || getCurrentDeviceId(),
    }
  }

  // Bidirectional sync: keep local data for offline usage and reconcile with cloud when online.
  async function migrateLocalTodos(): Promise<boolean> {
    if (!isOnline.value || !isElectricConfigured()) {
      return false
    }

    isMigrating.value = true
    syncError.value = false

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        throw new Error('Cloud sync is not configured: missing Supabase credentials')
      }

      const localTodos: Todo[] = localTodosCollection.toArray
      const { data: remoteData, error: fetchError } = await supabase
        .from('todos')
        .select('id,label,week_number,done,archived,created_at,updated_at,device_id')

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      const remoteTodos: RemoteTodoRow[] = (remoteData ?? []) as RemoteTodoRow[]

      const remoteById = new Map(remoteTodos.map((todo) => [todo.id, todo]))

      const localUpserts = localTodos
        .filter((todo) => {
          const remote = remoteById.get(todo.id)
          if (!remote) return true
          return todo.updatedAt >= Number(remote.updated_at)
        })
        .map(toDbRow)

      if (localUpserts.length > 0) {
        const { error: upsertError } = await supabase
          .from('todos')
          .upsert(localUpserts, { onConflict: 'id' })

        if (upsertError) {
          throw new Error(upsertError.message)
        }
      }

      const localById = new Map<string, Todo>(localTodos.map((todo) => [todo.id, todo]))
      const remoteDeletes = remoteTodos
        .filter((remote) => !localById.has(remote.id))
        .map((remote) => remote.id)

      if (remoteDeletes.length > 0) {
        const { error: deleteError } = await supabase.from('todos').delete().in('id', remoteDeletes)

        if (deleteError) {
          throw new Error(deleteError.message)
        }
      }

      for (const remote of remoteTodos) {
        const existing = localById.get(remote.id)
        const remoteUpdatedAt = Number(remote.updated_at)

        if (!existing) {
          localTodosCollection.insert({
            id: remote.id,
            label: remote.label,
            weekNumber: remote.week_number,
            done: remote.done,
            archived: remote.archived,
            createdAt: Number(remote.created_at),
            updatedAt: remoteUpdatedAt,
            deviceId: remote.device_id,
          })
          continue
        }

        if (remoteUpdatedAt > existing.updatedAt) {
          localTodosCollection.update(existing.id, (draft) => {
            draft.label = remote.label
            draft.weekNumber = remote.week_number
            draft.done = remote.done
            draft.archived = remote.archived
            draft.createdAt = Number(remote.created_at)
            draft.updatedAt = remoteUpdatedAt
            draft.deviceId = remote.device_id
          })
        }
      }

      hasSyncedOnce.value = true
      syncError.value = false
      return true
    } catch (error) {
      console.error('Migration failed:', error)
      syncError.value = true
      return false
    } finally {
      isMigrating.value = false
    }
  }

  function addTodo(label: string, weekNumber: number | null): string {
    const id = crypto.randomUUID()
    const now = Date.now()

    const todo: Todo = {
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deviceId: getCurrentDeviceId(),
    }

    localTodosCollection.insert(todo)
    return id
  }

  function updateTodo(id: string, updates: Partial<Omit<Todo, 'id'>>): void {
    localTodosCollection.update(id, (draft: Todo) => {
      Object.assign(draft, updates, {
        updatedAt: Date.now(),
        deviceId: getCurrentDeviceId(),
      })
    })
  }

  function deleteTodo(id: string): void {
    localTodosCollection.delete(id)
  }

  function toggleTodoDone(id: string): void {
    const todo = todos.value?.find((t) => t.id === id)
    if (todo) {
      updateTodo(id, { done: !todo.done })
    }
  }

  function archiveTodo(id: string): void {
    updateTodo(id, { archived: true })
  }

  // Get count of local-only todos that haven't been migrated
  const localTodosCount = computed(() => {
    return Array.from(localTodosCollection.entries()).length
  })

  // Expose a manual sync action in case automatic sync fails.
  const needsMigration = computed(() => {
    return isElectricConfigured() && isOnline.value && !isMigrating.value && syncStatus.value === 'error'
  })

  watch(
    () => isOnline.value,
    (online) => {
      if (online && isElectricConfigured()) {
        void migrateLocalTodos()
      }
    },
    { immediate: true },
  )

  watch(
    () => todos.value?.map((todo) => `${todo.id}:${todo.updatedAt}`).join('|') ?? '',
    () => {
      if (!isElectricConfigured() || !isOnline.value || isMigrating.value || !hasSyncedOnce.value) {
        return
      }

      void migrateLocalTodos()
    },
  )

  return {
    todos: computed(() => todos.value ?? []),
    isOnline,
    isReady,
    isMigrating: computed(() => isMigrating.value),
    syncStatus,
    localTodosCount,
    needsMigration,
    isElectricEnabled: isElectricConfigured(),
    migrateLocalTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodoDone,
    archiveTodo,
  }
}
