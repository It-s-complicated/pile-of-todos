import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'
import { useLiveQuery } from '@tanstack/vue-db'

import {
  electricTodosCollection,
  getActiveCollection,
  getCurrentDeviceId,
  getGuestCollection,
  isElectricConfigured,
} from '@/db/collections'
import type { Todo } from '@/db/collections'
import { shouldShowGuestClaimPrompt } from '@/lib/auth-allowlist'
import { claimGuestTodos } from '@/lib/todo-storage'
import { shouldPushTodoForUser, shouldWriteTodoToRemote } from '@/lib/todo-sync'
import { useAuth } from './useAuth'
import { useNetworkStatus } from './useNetworkStatus'

function normalizeTodo(todo: Todo): Todo {
  return {
    ...todo,
    userId: todo.userId ?? null,
    deletedAt: todo.deletedAt ?? null,
  }
}

function needsRemoteWrite(localTodo: Todo, remoteTodo: Todo | undefined) {
  return shouldWriteTodoToRemote(localTodo, remoteTodo, localTodo.userId)
}

function getTodoFingerprint(todos: Todo[]) {
  return todos.map((todo) => `${todo.id}:${todo.updatedAt}:${todo.deletedAt ?? 'active'}`).join('|')
}

function getPendingLocalTodos(
  localTodosToCheck: Todo[],
  remoteTodosToCompare: Todo[],
  activeUserId: string | null,
) {
  const remoteById = new Map(remoteTodosToCompare.map((todo) => [todo.id, todo]))

  return localTodosToCheck.filter((todo) => {
    if (!shouldPushTodoForUser(todo, activeUserId)) {
      return false
    }

    return needsRemoteWrite(todo, remoteById.get(todo.id))
  })
}

const handledClaimPromptUserIds = ref<string[]>([])

type TodoDataState = {
  auth: {
    accessState: ReturnType<typeof useAuth>['accessState']
    activeUserId: ComputedRef<string | null>
    isAuthReady: ReturnType<typeof useAuth>['isAuthReady']
    isAuthenticated: ReturnType<typeof useAuth>['isAuthenticated']
  }
  collections: {
    activeLocal: ComputedRef<ReturnType<typeof getActiveCollection>>
    guest: ReturnType<typeof getGuestCollection>
  }
  connectivity: {
    isElectricEnabled: boolean
    isOnline: ReturnType<typeof useNetworkStatus>['isOnline']
    isReady: ComputedRef<boolean>
  }
  guestClaim: {
    claim: () => boolean
    guestTodoCount: ComputedRef<number>
    keepSeparate: () => boolean
    visible: ComputedRef<boolean>
  }
  snapshots: {
    guest: ComputedRef<Todo[]>
    local: ComputedRef<Todo[]>
    remote: ComputedRef<Todo[]>
    remoteForActiveUser: ComputedRef<Todo[]>
  }
  syncInputs: {
    canSync: ComputedRef<boolean>
    isRemoteQueryReady: ComputedRef<boolean>
    pendingLocalTodos: ComputedRef<Todo[]>
    syncPlan: ComputedRef<{
      activeUserId: string
      localFingerprint: string
      remoteFingerprint: string
    } | null>
  }
  todos: {
    add: (label: string, weekNumber: number | null) => string
    archive: (id: string) => void
    count: ComputedRef<number>
    list: ComputedRef<Todo[]>
    remove: (id: string) => void
    toggleDone: (id: string) => void
    update: (id: string, updates: Partial<Omit<Todo, 'id'>>) => void
  }
}

let sharedTodoData: TodoDataState | null = null

export function useTodoData(): TodoDataState {
  if (sharedTodoData) {
    return sharedTodoData
  }

  const { isOnline } = useNetworkStatus()
  const { accessState, isAuthReady, isAuthenticated, userId: authenticatedUserId } = useAuth()
  const isElectricEnabled = isElectricConfigured()

  const activeUserId = computed(() =>
    accessState.value === 'approved' ? authenticatedUserId.value : null,
  )
  const activeLocalCollection = computed(() => getActiveCollection(activeUserId.value))
  const guestCollection = getGuestCollection()

  const { data: localTodos, isReady } = useLiveQuery(
    (q) => q.from({ todo: activeLocalCollection.value }).select(({ todo }) => todo),
    [activeLocalCollection],
  )
  const { data: guestTodos } = useLiveQuery((q) =>
    q.from({ todo: guestCollection }).select(({ todo }) => todo),
  )
  const { data: remoteTodos, isReady: isRemoteQueryReady } = useLiveQuery((q) =>
    q.from({ todo: electricTodosCollection }).select(({ todo }) => todo),
  )

  const localSnapshot = computed(() => (localTodos.value ?? []).map((todo) => normalizeTodo(todo)))
  const guestSnapshot = computed(() => (guestTodos.value ?? []).map((todo) => normalizeTodo(todo)))
  const remoteSnapshot = computed(() =>
    (remoteTodos.value ?? []).map((todo) => normalizeTodo(todo)),
  )
  const remoteForActiveUser = computed(() =>
    remoteSnapshot.value.filter((todo) => todo.userId === activeUserId.value),
  )
  const guestTodoCount = computed(
    () => guestSnapshot.value.filter((todo) => todo.deletedAt === null).length,
  )
  const hasHandledClaimPrompt = computed(() =>
    activeUserId.value === null
      ? false
      : handledClaimPromptUserIds.value.includes(activeUserId.value),
  )
  const claimPromptVisible = computed(() =>
    shouldShowGuestClaimPrompt({
      isAuthenticated: isAuthenticated.value && accessState.value === 'approved',
      guestTodoCount: guestTodoCount.value,
      hasHandledClaimPrompt: hasHandledClaimPrompt.value,
    }),
  )

  const canSync = computed(
    () =>
      isElectricEnabled &&
      isOnline.value &&
      activeUserId.value !== null &&
      !claimPromptVisible.value,
  )
  const pendingLocalTodos = computed(() =>
    getPendingLocalTodos(localSnapshot.value, remoteForActiveUser.value, activeUserId.value),
  )
  const syncPlan = computed(() => {
    if (!canSync.value || !activeUserId.value) {
      return null
    }

    return {
      activeUserId: activeUserId.value,
      localFingerprint: getTodoFingerprint(localSnapshot.value),
      remoteFingerprint: getTodoFingerprint(remoteForActiveUser.value),
    }
  })

  function markClaimPromptHandled(userId: string) {
    if (!handledClaimPromptUserIds.value.includes(userId)) {
      handledClaimPromptUserIds.value = [...handledClaimPromptUserIds.value, userId]
    }
  }

  function claimGuestTodosToAccount() {
    if (!activeUserId.value) {
      return false
    }

    const guestTodosToClaim = guestSnapshot.value.filter((todo) => todo.deletedAt === null)

    if (guestTodosToClaim.length > 0) {
      activeLocalCollection.value.insert(
        claimGuestTodos(guestTodosToClaim, activeUserId.value, Date.now()),
      )
      guestCollection.delete(guestTodosToClaim.map((todo) => todo.id))
    }

    markClaimPromptHandled(activeUserId.value)
    return true
  }

  function keepGuestTodosSeparate() {
    if (!activeUserId.value) {
      return false
    }

    markClaimPromptHandled(activeUserId.value)
    return true
  }

  function addTodo(label: string, weekNumber: number | null) {
    const id = crypto.randomUUID()
    const now = Date.now()

    activeLocalCollection.value.insert({
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deviceId: getCurrentDeviceId(),
      userId: activeUserId.value,
      deletedAt: null,
    })

    return id
  }

  function updateTodo(id: string, updates: Partial<Omit<Todo, 'id'>>) {
    activeLocalCollection.value.update(id, (draft) => {
      Object.assign(draft, updates, {
        updatedAt: Date.now(),
        deviceId: getCurrentDeviceId(),
      })
    })
  }

  function deleteTodo(id: string) {
    updateTodo(id, { deletedAt: Date.now() })
  }

  function toggleTodoDone(id: string) {
    const todo = localSnapshot.value.find((item) => item.id === id)

    if (todo && todo.deletedAt === null) {
      updateTodo(id, { done: !todo.done })
    }
  }

  function archiveTodo(id: string) {
    updateTodo(id, { archived: true })
  }

  sharedTodoData = {
    auth: {
      accessState,
      activeUserId,
      isAuthReady,
      isAuthenticated,
    },
    collections: {
      activeLocal: activeLocalCollection,
      guest: guestCollection,
    },
    connectivity: {
      isElectricEnabled,
      isOnline,
      isReady,
    },
    guestClaim: {
      claim: claimGuestTodosToAccount,
      guestTodoCount,
      keepSeparate: keepGuestTodosSeparate,
      visible: claimPromptVisible,
    },
    snapshots: {
      guest: guestSnapshot,
      local: localSnapshot,
      remote: remoteSnapshot,
      remoteForActiveUser,
    },
    syncInputs: {
      canSync,
      isRemoteQueryReady,
      pendingLocalTodos,
      syncPlan,
    },
    todos: {
      add: addTodo,
      archive: archiveTodo,
      count: computed(() => localSnapshot.value.length),
      list: localSnapshot,
      remove: deleteTodo,
      toggleDone: toggleTodoDone,
      update: updateTodo,
    },
  }

  return sharedTodoData
}
