import { useElectricTodos } from './useElectricTodos'
import { useTodoSync } from './useTodoSync'

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
