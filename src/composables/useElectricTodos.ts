import { computed } from 'vue'

import { declineStagedMigrationTodos } from '@/lib/todo-storage'

import { useTodoData } from './useTodoData.ts'
import { useTodoMutations } from './useTodoMutations.ts'
import { useTodoSync } from './useTodoSync.ts'

export type TodoMigrationStatus = 'none' | 'available' | 'promoting' | 'declined'

function getCreateTodoDisabledReason(
  accessState: ReturnType<typeof useTodoData>['auth']['accessState']['value'],
) {
  if (accessState === 'approved') {
    return null
  }

  return 'Sign in with the approved account to create todos.'
}

function getKeepMigrationDisabledReason(
  accessState: ReturnType<typeof useTodoData>['auth']['accessState']['value'],
  migrationStatus: TodoMigrationStatus,
  promotableTodoCount: number,
) {
  if (migrationStatus !== 'available' || promotableTodoCount === 0) {
    return null
  }

  if (accessState === 'approved') {
    return null
  }

  return 'Sign in with the approved account to keep staged todos.'
}

export function useElectricTodos() {
  const todoData = useTodoData()
  const todoSync = useTodoSync()
  const todoMutations = useTodoMutations()
  const createTodoDisabledReason = computed(() =>
    getCreateTodoDisabledReason(todoData.auth.accessState.value),
  )
  const migration = computed(() => {
    const status = todoData.migration.status.value
    const promotableTodoCount = todoData.migration.state.value.stagedTodos.filter(
      (stagedTodo) => stagedTodo.deletedAt === null,
    ).length
    const keepDisabledReason = getKeepMigrationDisabledReason(
      todoData.auth.accessState.value,
      status,
      promotableTodoCount,
    )
    const canKeep = status === 'available' && promotableTodoCount > 0 && keepDisabledReason === null
    const canDecline = status === 'available'

    return {
      canDecline,
      canKeep,
      decline() {
        if (!canDecline) {
          return false
        }

        return declineStagedMigrationTodos()
      },
      keep() {
        if (!canKeep) {
          return []
        }

        return todoMutations.keepStagedMigrationTodos()
      },
      keepDisabledReason,
      stagedTodoCount: promotableTodoCount,
      status,
    }
  })

  return {
    addTodo: todoMutations.createTodo,
    canCreateTodos: computed(() => createTodoDisabledReason.value === null),
    createTodoDisabledReason,
    deleteTodo: todoMutations.deleteTodo,
    isOnline: todoData.connectivity.isOnline,
    isReady: todoData.connectivity.isReady,
    migration,
    restoreTodo: todoMutations.restoreTodo,
    statuses: {
      degraded: todoSync.degradedStatus,
      migration: computed<TodoMigrationStatus>(() => migration.value.status),
      sync: todoSync.syncStatus,
    },
    todos: todoData.readModel.todos,
    updateTodo: todoMutations.updateTodo,
  }
}
