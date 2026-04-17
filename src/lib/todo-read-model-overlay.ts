import type { Todo } from '@/db/collections'
import type { QueuedTodoMutationEntry } from '@/lib/offline-todo-mutation-queue'

function normalizeTodo(todo: Todo): Todo {
  return {
    ...todo,
    deletedAt: todo.deletedAt ?? null,
    userId: todo.userId ?? null,
  }
}

export function mergeTodoReadModel(
  confirmedTodos: Todo[],
  pendingMutations: readonly QueuedTodoMutationEntry[],
): Todo[] {
  const mergedTodos = new Map(confirmedTodos.map((todo) => [todo.id, normalizeTodo(todo)]))

  for (const entry of pendingMutations.toSorted((left, right) => left.queuedAt - right.queuedAt)) {
    mergedTodos.set(entry.mutation.todoId, normalizeTodo(entry.mutation.optimisticTodo))
  }

  return [...mergedTodos.values()]
}
