import { computed, readonly } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'

import { getConfirmedTodosCollection } from '@/db/confirmed-todos'
import type { Todo } from '@/db/collections'
import { buildTodoOverlay } from '@/lib/todo-overlay'
import type { PendingMutationEntry } from '@/lib/pending-mutation-storage'

type UseTodoReadModelOptions = {
  pendingMutations: Ref<PendingMutationEntry[]>
}

type TodoReadModel = {
  confirmedTodos: ComputedRef<Todo[]>
  pendingMutations: Readonly<Ref<readonly PendingMutationEntry[]>>
  todos: ComputedRef<Todo[]>
  isReady: Readonly<Ref<boolean>>
}

function normalizeTodo(todo: Todo): Todo {
  return {
    ...todo,
    userId: todo.userId ?? null,
    deletedAt: todo.deletedAt ?? null,
  }
}

export function useTodoReadModel(options: UseTodoReadModelOptions): TodoReadModel {
  const confirmedCollection = getConfirmedTodosCollection()
  const { data: confirmedRows, isReady } = useLiveQuery((q) =>
    q.from({ todo: confirmedCollection }).select(({ todo }) => todo),
  )

  const confirmedTodos = computed(() =>
    (confirmedRows.value ?? []).map((todo) => normalizeTodo(todo)),
  )
  const todos = computed(() =>
    buildTodoOverlay({
      confirmedTodos: confirmedTodos.value,
      pendingMutations: options.pendingMutations.value,
    }),
  )

  return {
    confirmedTodos,
    pendingMutations: readonly(options.pendingMutations),
    todos,
    isReady,
  }
}
