import type { Todo } from '@/db/collections'

import {
  isActivePendingMutationStatus,
  type PendingMutationEntry,
} from './pending-mutation-storage'

type BuildTodoOverlayOptions = {
  confirmedTodos: Todo[]
  pendingMutations: readonly PendingMutationEntry[]
}

function toTodoMap(todos: Todo[]) {
  return new Map(todos.map((todo) => [todo.id, { ...todo }]))
}

function applyOptimisticUpdate(baseTodo: Todo | undefined, mutation: PendingMutationEntry) {
  if (!mutation.optimisticTodo) {
    return baseTodo
  }

  if (!baseTodo) {
    return { ...mutation.optimisticTodo }
  }

  if (mutation.intent.kind !== 'update') {
    return { ...mutation.optimisticTodo }
  }

  const nextTodo = { ...baseTodo }
  const optimisticTodo = mutation.optimisticTodo
  const updatedValues = mutation.intent.values

  if (updatedValues.label !== undefined) {
    nextTodo.label = optimisticTodo.label
  }

  if (updatedValues.weekNumber !== undefined) {
    nextTodo.weekNumber = optimisticTodo.weekNumber
  }

  if (updatedValues.done !== undefined) {
    nextTodo.done = optimisticTodo.done
  }

  if (updatedValues.archived !== undefined) {
    nextTodo.archived = optimisticTodo.archived
  }

  if (updatedValues.deletedAt !== undefined) {
    nextTodo.deletedAt = optimisticTodo.deletedAt
  }

  nextTodo.updatedAt = optimisticTodo.updatedAt

  return nextTodo
}

export function buildTodoOverlay({ confirmedTodos, pendingMutations }: BuildTodoOverlayOptions) {
  const todosById = toTodoMap(confirmedTodos)

  for (const mutation of pendingMutations) {
    if (!isActivePendingMutationStatus(mutation.status)) {
      continue
    }

    if (mutation.intent.kind === 'delete') {
      todosById.delete(mutation.todoId)
      continue
    }

    if (mutation.intent.kind === 'create' && todosById.has(mutation.todoId)) {
      continue
    }

    const nextTodo = applyOptimisticUpdate(todosById.get(mutation.todoId), mutation)

    if (nextTodo) {
      todosById.set(mutation.todoId, nextTodo)
    }
  }

  return [...todosById.values()].sort((left, right) => left.createdAt - right.createdAt)
}
