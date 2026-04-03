import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import {
  migrateLegacyBucketsToGuestMigrationInput,
  readMigrationInputTodos,
  readTodoMigrationState,
  subscribeToMigrationInputChanges,
} from '@/lib/todo-storage'

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
  migration: {
    isAvailable: ComputedRef<boolean>
    isDeclined: ComputedRef<boolean>
    isPromoting: ComputedRef<boolean>
    stagedTodoCount: ComputedRef<number>
    state: ComputedRef<ReturnType<typeof readTodoMigrationState>>
    status: ComputedRef<ReturnType<typeof readTodoMigrationState>['status']>
  }
  readModel: ReturnType<typeof useTodoReadModel>
  sync: {
    controller: ReturnType<typeof useTodoSyncController>
  }
}

let sharedTodoData: TodoDataState | null = null

function readVisibleMigrationTodoCount() {
  try {
    return readMigrationInputTodos().filter((todo) => todo.deletedAt === null).length
  } catch {
    return 0
  }
}

function readDurableMigrationState() {
  return readTodoMigrationState()
}

export function useTodoData(): TodoDataState {
  if (sharedTodoData) {
    return sharedTodoData
  }

  const { isOnline } = useNetworkStatus()
  const { accessState, isAuthReady, isAuthenticated, userId } = useAuth()
  const controller = useTodoSyncController()
  const readModel = useTodoReadModel({ pendingMutations: controller.pendingMutations })

  try {
    migrateLegacyBucketsToGuestMigrationInput()
  } catch {
    // Ignore malformed legacy storage and continue booting with an empty migration count.
  }

  const migrationTodoCount = ref(readVisibleMigrationTodoCount())
  const durableMigrationState = ref(readDurableMigrationState())

  subscribeToMigrationInputChanges(() => {
    migrationTodoCount.value = readVisibleMigrationTodoCount()
    durableMigrationState.value = readDurableMigrationState()
  })

  const activeUserId = computed(() => (accessState.value === 'approved' ? userId.value : null))
  const guestTodoCount = computed(() => migrationTodoCount.value)

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
    migration: {
      isAvailable: computed(() => durableMigrationState.value.status === 'available'),
      isDeclined: computed(() => durableMigrationState.value.status === 'declined'),
      isPromoting: computed(() => durableMigrationState.value.status === 'promoting'),
      stagedTodoCount: computed(() => durableMigrationState.value.stagedTodos.length),
      state: computed(() => durableMigrationState.value),
      status: computed(() => durableMigrationState.value.status),
    },
    readModel,
    sync: {
      controller,
    },
  }

  return sharedTodoData
}
