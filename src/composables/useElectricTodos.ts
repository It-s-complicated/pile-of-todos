import { useTodoData } from './useTodoData'
import { useTodoSync } from './useTodoSync'

export function useElectricTodos() {
  const todoData = useTodoData()
  const todoSync = useTodoSync()

  return {
    addTodo: todoData.todos.add,
    archiveTodo: todoData.todos.archive,
    canRetrySync: todoSync.canRetrySync,
    claimGuestTodos: todoData.guestClaim.claim,
    claimPromptVisible: todoData.guestClaim.visible,
    deleteTodo: todoData.todos.remove,
    guestTodoCount: todoData.guestClaim.guestTodoCount,
    isMigrating: todoSync.isSyncing,
    isOnline: todoData.connectivity.isOnline,
    isReady: todoData.connectivity.isReady,
    keepGuestTodosSeparate: todoData.guestClaim.keepSeparate,
    lastSyncedAt: todoSync.lastSyncedAt,
    localTodosCount: todoData.todos.count,
    needsSync: todoSync.needsSync,
    syncStatus: todoSync.status,
    todos: todoData.todos.list,
    toggleTodoDone: todoData.todos.toggleDone,
    updateTodo: todoData.todos.update,
  }
}
