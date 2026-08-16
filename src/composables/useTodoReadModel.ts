import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { eq, useLiveQuery } from '@tanstack/vue-db'

import { getConfirmedTodosCollection, mapConfirmedTodoRow } from '@/db/confirmed-todos'
import type { Todo } from '@/db/collections'
import { mergeTodoReadModel } from '@/lib/todo-read-model-overlay'

import { useAuth } from './useAuth'
import { useTodoMutationQueueController } from './useTodoCreateQueueController'

type TodoReadModel = {
  confirmedTodos: ComputedRef<Todo[]>
  isReady: Readonly<Ref<boolean>>
  todos: ComputedRef<Todo[]>
}

export function useTodoReadModel(): TodoReadModel {
  const { accessState, isAuthReady, userId } = useAuth()
  const confirmedCollection = getConfirmedTodosCollection()
  const activeUserId = computed(() => (accessState.value === 'signed-in' ? userId.value : null))
  const { data: confirmedRows, isReady: isQueryReady } = useLiveQuery(
    (q) => {
      const currentUserId = activeUserId.value

      if (!isAuthReady.value || !currentUserId) {
        return undefined
      }

      return q
        .from({ todo: confirmedCollection })
        .where(({ todo }) => eq(todo.user_id, currentUserId))
        .select(({ todo }) => todo)
    },
    [isAuthReady, activeUserId],
  )
  const mutationQueue = useTodoMutationQueueController()

  const confirmedTodos = computed(() =>
    activeUserId.value
      ? (confirmedRows.value ?? [])
          .filter((row) => row.user_id === activeUserId.value)
          .map(mapConfirmedTodoRow)
      : [],
  )

  return {
    confirmedTodos,
    isReady: computed(
      () => isAuthReady.value && (activeUserId.value === null || isQueryReady.value),
    ),
    todos: computed(() =>
      mergeTodoReadModel(confirmedTodos.value, mutationQueue.pendingMutations.value),
    ),
  }
}
