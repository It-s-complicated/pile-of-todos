import { getCurrentDeviceId, type Todo } from '@/db/collections'
import { getSupabaseClient } from '@/lib/supabase'
import {
  TodoRemoteWriteError,
  buildRemoteTodoRow,
  updateRemoteTodo,
  upsertRemoteTodo,
} from '@/lib/todo-sync'

import { useTodoData } from './useTodoData'

type TodoUpdates = Partial<Omit<Todo, 'id'>>

function buildOptimisticTodo(todo: Todo, updates: TodoUpdates): Todo {
  return {
    ...todo,
    ...updates,
    updatedAt: updates.updatedAt ?? Date.now(),
    deviceId: updates.deviceId ?? todo.deviceId ?? getCurrentDeviceId(),
    userId: updates.userId ?? todo.userId ?? null,
    deletedAt: updates.deletedAt ?? todo.deletedAt ?? null,
  }
}

function hasOwn<TObject extends object, TKey extends PropertyKey>(
  value: TObject,
  key: TKey,
): value is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function getRequiredActiveUserId(activeUserId: string | null, action: string) {
  if (!activeUserId) {
    throw new Error(`Cannot ${action} without an approved account`)
  }

  return activeUserId
}

let sharedTodoMutations: ReturnType<typeof createTodoMutations> | null = null

function createTodoMutations() {
  const todoData = useTodoData()

  function getConfirmedTodo(todoId: string) {
    return todoData.readModel.confirmedTodos.value.find((todo) => todo.id === todoId)
  }

  function requireOnline(action: string) {
    if (todoData.connectivity.isOnline.value) {
      return
    }

    throw new Error(`Cannot ${action} while offline`)
  }

  async function createTodo(label: string, weekNumber: number | null) {
    const activeUserId = getRequiredActiveUserId(todoData.auth.activeUserId.value, 'create a todo')
    const now = Date.now()
    const nextTodo: Todo = {
      id: crypto.randomUUID(),
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deviceId: getCurrentDeviceId(),
      userId: activeUserId,
      deletedAt: null,
    }

    if (!todoData.connectivity.isOnline.value) {
      todoData.sync.controller.queueCreate(nextTodo)
      return nextTodo.id
    }

    try {
      await upsertRemoteTodo(
        getSupabaseClient(),
        buildRemoteTodoRow(nextTodo, activeUserId, getCurrentDeviceId()),
      )
      todoData.sync.controller.clearSyncError()
      return nextTodo.id
    } catch (error) {
      if (
        error instanceof TodoRemoteWriteError &&
        error.kind === 'retryable' &&
        !todoData.connectivity.isOnline.value
      ) {
        todoData.sync.controller.queueCreate(nextTodo)
        return nextTodo.id
      }

      if (error instanceof TodoRemoteWriteError && error.kind === 'auth') {
        todoData.sync.controller.markRequiresReauth(error.message)
      }

      throw error
    }
  }

  async function updateTodo(id: string, updates: TodoUpdates) {
    const existingTodo = getConfirmedTodo(id)

    if (!existingTodo) {
      throw new Error(`Cannot update todo ${id} because it does not exist in the remote read model`)
    }

    requireOnline('update a todo')
    const activeUserId = getRequiredActiveUserId(todoData.auth.activeUserId.value, 'update a todo')
    const optimisticTodo = buildOptimisticTodo(existingTodo, updates)

    try {
      await updateRemoteTodo(getSupabaseClient(), {
        activeUserId,
        todoId: id,
        updates: {
          ...(hasOwn(updates, 'archived') ? { archived: optimisticTodo.archived } : {}),
          ...(hasOwn(updates, 'deletedAt') ? { deletedAt: optimisticTodo.deletedAt } : {}),
          ...(hasOwn(updates, 'done') ? { done: optimisticTodo.done } : {}),
          ...(hasOwn(updates, 'label') ? { label: optimisticTodo.label } : {}),
          ...(hasOwn(updates, 'weekNumber') ? { weekNumber: optimisticTodo.weekNumber } : {}),
          deviceId: getCurrentDeviceId(),
          updatedAt: optimisticTodo.updatedAt,
        },
      })
      todoData.sync.controller.clearSyncError()
    } catch (error) {
      if (error instanceof TodoRemoteWriteError && error.kind === 'auth') {
        todoData.sync.controller.markRequiresReauth(error.message)
      }

      throw error
    }
  }

  function deleteTodo(id: string) {
    return updateTodo(id, { deletedAt: Date.now() })
  }

  function restoreTodo(id: string) {
    return updateTodo(id, { deletedAt: null })
  }

  return {
    createTodo,
    deleteTodo,
    restoreTodo,
    updateTodo,
  }
}

export function useTodoMutations() {
  if (sharedTodoMutations) {
    return sharedTodoMutations
  }

  sharedTodoMutations = createTodoMutations()
  return sharedTodoMutations
}
