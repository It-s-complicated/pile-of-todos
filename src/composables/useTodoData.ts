import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useAuth } from './useAuth'
import { useNetworkStatus } from './useNetworkStatus'
import { useTodoCreateQueueController } from './useTodoCreateQueueController'
import { useTodoReadModel } from './useTodoReadModel'

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
  readModel: ReturnType<typeof useTodoReadModel>
  sync: {
    controller: ReturnType<typeof useTodoCreateQueueController>
  }
}

let sharedTodoData: TodoDataState | null = null

export function useTodoData(): TodoDataState {
  if (sharedTodoData) {
    return sharedTodoData
  }

  const { isOnline } = useNetworkStatus()
  const { accessState, isAuthReady, isAuthenticated, userId } = useAuth()
  const controller = useTodoCreateQueueController()
  const readModel = useTodoReadModel()
  const activeUserId = computed(() => (accessState.value === 'approved' ? userId.value : null))

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
    readModel,
    sync: {
      controller,
    },
  }

  return sharedTodoData
}
