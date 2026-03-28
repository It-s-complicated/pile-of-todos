import { useTodoSync } from './useTodoSync'

export function useSyncElectricTodos() {
  const { syncTodos } = useTodoSync()

  return {
    syncTodos,
  }
}
