import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'

import { getConfirmedTodosCollection } from '@/db/confirmed-todos'
import type { Todo } from '@/db/collections'
import { mergeTodoReadModel } from '@/lib/todo-read-model-overlay'

import { useTodoMutationQueueController } from './useTodoCreateQueueController'

type TodoReadModel = {
  confirmedTodos: ComputedRef<Todo[]>
  isReady: Readonly<Ref<boolean>>
  todos: ComputedRef<Todo[]>
}

function normalizeTodo(todo: Todo): Todo {
  return {
    ...todo,
    userId: todo.userId ?? null,
    deletedAt: todo.deletedAt ?? null,
  }
}

export function useTodoReadModel(): TodoReadModel {
  const confirmedCollection = getConfirmedTodosCollection()
  const mutationQueue = useTodoMutationQueueController()
  const { data: confirmedRows, isReady } = useLiveQuery((q) =>
    q.from({ todo: confirmedCollection }).select(({ todo }) => todo),
  )

  const confirmedTodos = computed(() =>
    (confirmedRows.value ?? []).map((todo) => normalizeTodo(todo as unknown as Todo)),
  )

  return {
    confirmedTodos,
    isReady,
    todos: computed(() =>
      mergeTodoReadModel(confirmedTodos.value, mutationQueue.pendingMutations.value),
    ),
  }
}
