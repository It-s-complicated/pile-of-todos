import { computed } from 'vue'

import { useTodoData } from './useTodoData.ts'
import { useTodoMutations } from './useTodoMutations.ts'
import { useTodoSync } from './useTodoSync.ts'

function getCreateTodoDisabledReason(
  accessState: ReturnType<typeof useTodoData>['auth']['accessState']['value'],
) {
  if (accessState === 'approved') {
    return null
  }

  return 'Sign in with the approved account to create todos.'
}

function getMutateTodoDisabledReason(
  accessState: ReturnType<typeof useTodoData>['auth']['accessState']['value'],
  isOnline: boolean,
) {
  if (accessState === 'approved') {
    return isOnline ? null : 'Reconnect to update todos.'
  }

  return 'Sign in with the approved account to update todos.'
}

export function useElectricTodos() {
  const todoData = useTodoData()
  const todoSync = useTodoSync()
  const todoMutations = useTodoMutations()
  const createTodoDisabledReason = computed(() =>
    getCreateTodoDisabledReason(todoData.auth.accessState.value),
  )
  const mutateTodoDisabledReason = computed(() =>
    getMutateTodoDisabledReason(
      todoData.auth.accessState.value,
      todoData.connectivity.isOnline.value,
    ),
  )

  return {
    addTodo: todoMutations.createTodo,
    canCreateTodos: computed(() => createTodoDisabledReason.value === null),
    canMutateTodos: computed(() => mutateTodoDisabledReason.value === null),
    createTodoDisabledReason,
    deleteTodo: todoMutations.deleteTodo,
    isOnline: todoData.connectivity.isOnline,
    isReady: todoData.connectivity.isReady,
    mutateTodoDisabledReason,
    offlineQueue: computed(() => ({
      count: todoData.sync.controller.queuedCreateCount.value,
      isFlushing: todoData.sync.controller.isFlushing.value,
      lastError: todoData.sync.controller.lastError.value,
    })),
    restoreTodo: todoMutations.restoreTodo,
    statuses: {
      degraded: todoSync.degradedStatus,
      sync: todoSync.syncStatus,
    },
    todos: todoData.readModel.todos,
    updateTodo: todoMutations.updateTodo,
  }
}
