import { computed, ref } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'
import {
  electricTodosCollection,
  getCurrentDeviceId,
  isElectricConfigured,
  localTodosCollection,
  type Todo,
} from '@/db/collections'
import { useNetworkStatus } from './useNetworkStatus'

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local-only'

export function useElectricTodos() {
  const { isOnline } = useNetworkStatus()
  const isMigrating = ref(false)
  const syncStatus = ref<SyncStatus>(isElectricConfigured() ? 'syncing' : 'local-only')

  // Determine which collection to use:
  // - Use electric when configured and online
  // - Use localStorage when offline or when electric is not configured
  const activeCollection = computed(() => {
    if (!isElectricConfigured()) {
      return localTodosCollection
    }
    return isOnline.value ? electricTodosCollection : localTodosCollection
  })

  // Live query from active collection
  const { data: todos, isReady } = useLiveQuery((q) =>
    q.from({ todo: activeCollection.value }),
  )

  // Migration: Upload local todos to cloud
  async function migrateLocalTodos(): Promise<boolean> {
    if (!isOnline.value || !isElectricConfigured()) {
      return false
    }

    isMigrating.value = true
    syncStatus.value = 'syncing'

    try {
      const localTodos = localTodosCollection.utils.getAll()

      for (const todo of localTodos) {
        const todoWithDevice = {
          ...todo,
          deviceId: todo.deviceId || getCurrentDeviceId(),
        }

        const apiUrl = import.meta.env.VITE_API_BASE_URL
        const url = new URL(`${apiUrl}/todos-stream`)
        const sourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID
        const secret = import.meta.env.VITE_ELECTRIC_SECRET

        if (sourceId && secret) {
          url.searchParams.set('source_id', sourceId)
          url.searchParams.set('secret', secret)
        }

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(todoWithDevice),
        })

        if (!response.ok) {
          throw new Error(`Failed to migrate todo ${todo.id}: ${response.statusText}`)
        }
      }

      // Clear local storage after successful migration
      localTodosCollection.utils.clear()
      syncStatus.value = 'synced'
      return true
    }
    catch (error) {
      console.error('Migration failed:', error)
      syncStatus.value = 'error'
      return false
    }
    finally {
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

    // Insert into active collection
    // If online with electric: triggers onInsert handler -> API call -> waits for txid
    // If offline: stores locally, syncs when reconnected
    activeCollection.value.insert(todo)
    return id
  }

  function updateTodo(id: string, updates: Partial<Omit<Todo, 'id'>>): void {
    activeCollection.value.update(id, (draft: Todo) => {
      Object.assign(draft, updates, {
        updatedAt: Date.now(),
        deviceId: getCurrentDeviceId(),
      })
    })
  }

  function deleteTodo(id: string): void {
    activeCollection.value.delete(id)
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
    // console.log(Array.from(localTodosCollection.entries()))
    return Array.from(localTodosCollection.entries()).length
    // return localTodosCollection.utils.getAll().length
  })

  // Check if migration is needed (has local data and electric is configured)
  const needsMigration = computed(() => {
    return localTodosCount.value > 0 && isElectricConfigured()
  })

  return {
    todos: computed(() => todos.value ?? []),
    isOnline,
    isReady,
    isMigrating: computed(() => isMigrating.value),
    syncStatus: computed(() => syncStatus.value),
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
