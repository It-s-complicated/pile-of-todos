import { useElectricTodos } from './useElectricTodos.ts'
import { useTodoSync } from './useTodoSync.ts'

export function useSyncElectricTodos() {
  const { statuses } = useElectricTodos()
  const { canRetrySync, degradedStatus, isSyncing, syncStatus, syncTodos } = useTodoSync()

  return {
    canRetrySync,
    degradedStatus,
    isSyncing,
    statuses,
    syncStatus,
    syncTodos,
  }
}
