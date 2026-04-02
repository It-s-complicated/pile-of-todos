import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'

import { getGuestCollection } from '@/db/collections'

import { useAuth } from './useAuth'
import { useNetworkStatus } from './useNetworkStatus'
import { useTodoReadModel } from './useTodoReadModel'
import { useTodoSyncController } from './useTodoSyncController'

type TodoDataState = {
  auth: {
    accessState: ReturnType<typeof useAuth>['accessState']
    activeUserId: ComputedRef<string | null>
    isAuthReady: ReturnType<typeof useAuth>['isAuthReady']
    isAuthenticated: ReturnType<typeof useAuth>['isAuthenticated']
  }
  connectivity: {
    isOnline: ReturnType<typeof useNetworkStatus>['isOnline']
    isReady: ComputedRef<boolean>
  }
  legacyGuest: {
    guestTodoCount: ComputedRef<number>
    hasGuestTodos: ComputedRef<boolean>
  }
  readModel: ReturnType<typeof useTodoReadModel>
  sync: {
    controller: ReturnType<typeof useTodoSyncController>
  }
}

let sharedTodoData: TodoDataState | null = null

export function useTodoData(): TodoDataState {
  if (sharedTodoData) {
    return sharedTodoData
  }

  const { isOnline } = useNetworkStatus()
  const { accessState, isAuthReady, isAuthenticated, userId } = useAuth()
  const controller = useTodoSyncController()
  const readModel = useTodoReadModel({ pendingMutations: controller.pendingMutations })
  const guestCollection = getGuestCollection()
  const { data: guestRows } = useLiveQuery((q) =>
    q.from({ todo: guestCollection }).select(({ todo }) => todo),
  )

  const activeUserId = computed(() => (accessState.value === 'approved' ? userId.value : null))
  const guestTodoCount = computed(
    () => (guestRows.value ?? []).filter((todo) => todo.deletedAt === null).length,
  )

  sharedTodoData = {
    auth: {
      accessState,
      activeUserId,
      isAuthReady,
      isAuthenticated,
    },
    connectivity: {
      isOnline,
      isReady: computed(() => isAuthReady.value && readModel.isReady.value),
    },
    legacyGuest: {
      guestTodoCount,
      hasGuestTodos: computed(() => guestTodoCount.value > 0),
    },
    readModel,
    sync: {
      controller,
    },
  }

  return sharedTodoData
}
