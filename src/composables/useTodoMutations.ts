import { getCurrentDeviceId, type Todo } from '@/db/collections'
import type { QueuedTodoMutation } from '@/lib/offline-todo-mutation-queue'

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
    throw new Error(`Cannot ${action} without a signed-in account`)
  }

  return activeUserId
}

let sharedTodoMutations: ReturnType<typeof createTodoMutations> | null = null

function createTodoMutations() {
  const todoData = useTodoData()

  function getVisibleTodo(todoId: string) {
    return todoData.readModel.todos.value.find((todo) => todo.id === todoId)
  }

  function queueMutation(mutation: QueuedTodoMutation) {
    todoData.sync.controller.queueMutation(mutation)
  }

  async function createTodo(label: string, weekNumber: number | null, id?: string) {
    const activeUserId = getRequiredActiveUserId(todoData.auth.activeUserId.value, 'create a todo')
    const now = Date.now()
    const nextTodo: Todo = {
      id: id ?? crypto.randomUUID(),
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

    queueMutation({
      kind: 'create',
      mutationId: crypto.randomUUID(),
      optimisticTodo: nextTodo,
      todoId: nextTodo.id,
      values: {
        archived: nextTodo.archived,
        createdAt: nextTodo.createdAt,
        deletedAt: nextTodo.deletedAt,
        done: nextTodo.done,
        label: nextTodo.label,
        updatedAt: nextTodo.updatedAt,
        weekNumber: nextTodo.weekNumber,
      },
    })

    return nextTodo.id
  }

  async function updateTodo(id: string, updates: TodoUpdates) {
    const existingTodo = getVisibleTodo(id)

    if (!existingTodo) {
      throw new Error(
        `Cannot update todo ${id} because it does not exist in the current read model`,
      )
    }

    getRequiredActiveUserId(todoData.auth.activeUserId.value, 'update a todo')
    const optimisticTodo = buildOptimisticTodo(existingTodo, updates)

    queueMutation({
      kind: 'update',
      mutationId: crypto.randomUUID(),
      optimisticTodo,
      todoId: id,
      updates: {
        ...(hasOwn(updates, 'archived') ? { archived: optimisticTodo.archived } : {}),
        ...(hasOwn(updates, 'createdAt') ? { createdAt: optimisticTodo.createdAt } : {}),
        ...(hasOwn(updates, 'deletedAt') ? { deletedAt: optimisticTodo.deletedAt } : {}),
        ...(hasOwn(updates, 'done') ? { done: optimisticTodo.done } : {}),
        ...(hasOwn(updates, 'label') ? { label: optimisticTodo.label } : {}),
        ...(hasOwn(updates, 'weekNumber') ? { weekNumber: optimisticTodo.weekNumber } : {}),
        updatedAt: optimisticTodo.updatedAt,
      },
    })
  }

  function deleteTodo(id: string) {
    const existingTodo = getVisibleTodo(id)

    if (!existingTodo) {
      throw new Error(
        `Cannot delete todo ${id} because it does not exist in the current read model`,
      )
    }

    getRequiredActiveUserId(todoData.auth.activeUserId.value, 'delete a todo')
    const deletedAt = Date.now()
    const optimisticTodo = buildOptimisticTodo(existingTodo, { deletedAt })

    queueMutation({
      kind: 'delete',
      mutationId: crypto.randomUUID(),
      optimisticTodo,
      todoId: id,
      updates: {
        deletedAt,
        updatedAt: optimisticTodo.updatedAt,
      },
    })

    return Promise.resolve()
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
