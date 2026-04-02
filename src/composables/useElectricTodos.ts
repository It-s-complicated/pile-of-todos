import { computed } from 'vue'

import { useTodoData } from './useTodoData'
import { useTodoMutations } from './useTodoMutations'
import { useTodoSync } from './useTodoSync'

export type TodoMigrationStatus = 'none' | 'legacy-guest-pending'

export function useElectricTodos() {
  const todoData = useTodoData()
  const todoSync = useTodoSync()
  const todoMutations = useTodoMutations()

  return {
    addTodo: todoMutations.createTodo,
    deleteTodo: todoMutations.deleteTodo,
    isOnline: todoData.connectivity.isOnline,
    isReady: todoData.connectivity.isReady,
    restoreTodo: todoMutations.restoreTodo,
    statuses: {
      degraded: todoSync.degradedStatus,
      migration: computed<TodoMigrationStatus>(() =>
        todoData.legacyGuest.hasGuestTodos.value ? 'legacy-guest-pending' : 'none',
      ),
      sync: todoSync.syncStatus,
    },
    todos: todoData.readModel.todos,
    updateTodo: todoMutations.updateTodo,
  }
}
