import { getCurrentDeviceId, type Todo } from '@/db/collections'
import { getConfirmedTodosCollection } from '@/db/confirmed-todos'
import {
  isActivePendingMutationStatus,
  type PendingMutationReference,
} from '@/lib/pending-mutation-storage'
import type { PendingMutationEntry } from '@/lib/pending-mutation-storage'
import { parseTodoMutationIntent } from '@/lib/todo-mutation-contract'
import { getSupabaseClient } from '@/lib/supabase'
import {
  TodoMutationSubmitError,
  buildTodoMutationIntent,
  submitTodoMutation,
} from '@/lib/todo-sync'

import { useTodoData } from './useTodoData'

type TodoUpdates = Partial<Omit<Todo, 'id'>>

function buildAuthenticatedUpdateIntent(todo: Todo, activeUserId: string) {
  return parseTodoMutationIntent({
    kind: 'update',
    mutationId: ['todo-mutation', activeUserId, todo.id, 'update', String(todo.updatedAt)].join(
      ':',
    ),
    todoId: todo.id,
    client: {
      deviceId: todo.deviceId ?? getCurrentDeviceId(),
    },
    values: {
      label: todo.label,
      weekNumber: todo.weekNumber,
      done: todo.done,
      archived: todo.archived,
      deletedAt: todo.deletedAt,
      updatedAt: todo.updatedAt,
    },
  })
}

function buildDeleteMutationId(todo: Todo, activeUserId: string | null) {
  const idSegments = [
    activeUserId ? 'todo-mutation' : 'guest-mutation',
    ...(activeUserId ? [activeUserId] : []),
    todo.id,
    'delete',
    String(todo.updatedAt),
    String(todo.deletedAt),
  ]

  return idSegments.join(':')
}

function buildDeleteMutationIntent(todo: Todo, activeUserId: string | null) {
  return parseTodoMutationIntent({
    kind: 'delete',
    mutationId: buildDeleteMutationId(todo, activeUserId),
    todoId: todo.id,
    client: {
      deviceId: todo.deviceId ?? getCurrentDeviceId(),
    },
    values: {
      deletedAt: todo.deletedAt,
      updatedAt: todo.updatedAt,
    },
  })
}

function buildGuestMutationIntent(todo: Todo, kind: 'create' | 'update' | 'delete') {
  const mutationId = [
    'guest-mutation',
    todo.id,
    kind,
    String(todo.updatedAt),
    String(todo.deletedAt ?? todo.createdAt),
  ].join(':')

  if (kind === 'create') {
    return parseTodoMutationIntent({
      kind: 'create',
      mutationId,
      todoId: todo.id,
      client: {
        deviceId: todo.deviceId ?? getCurrentDeviceId(),
      },
      values: {
        label: todo.label,
        weekNumber: todo.weekNumber,
        done: todo.done,
        archived: todo.archived,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        deletedAt: null,
      },
    })
  }

  if (kind === 'delete') {
    return parseTodoMutationIntent({
      kind: 'delete',
      mutationId,
      todoId: todo.id,
      client: {
        deviceId: todo.deviceId ?? getCurrentDeviceId(),
      },
      values: {
        deletedAt: todo.deletedAt,
        updatedAt: todo.updatedAt,
      },
    })
  }

  return parseTodoMutationIntent({
    kind: 'update',
    mutationId,
    todoId: todo.id,
    client: {
      deviceId: todo.deviceId ?? getCurrentDeviceId(),
    },
    values: {
      label: todo.label,
      weekNumber: todo.weekNumber,
      done: todo.done,
      archived: todo.archived,
      deletedAt: todo.deletedAt,
      updatedAt: todo.updatedAt,
    },
  })
}

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

function getPendingReferenceKey(entry: Pick<PendingMutationEntry, 'partitionKey' | 'mutationId'>) {
  return `${entry.partitionKey}:${entry.mutationId}`
}

function isCancelablePendingCreate(entry: PendingMutationEntry) {
  return entry.kind === 'create' && ['queued', 'retryable-error'].includes(entry.status)
}

function isBlockingPendingCreate(entry: PendingMutationEntry) {
  return entry.kind === 'create' && ['sending', 'accepted-awaiting-sync'].includes(entry.status)
}

let sharedTodoMutations: ReturnType<typeof createTodoMutations> | null = null

function createTodoMutations() {
  const todoData = useTodoData()

  function getConfirmedTodo(todoId: string) {
    return todoData.readModel.confirmedTodos.value.find((todo) => todo.id === todoId)
  }

  function getActivePendingMutations(todoId: string) {
    return todoData.sync.controller.pendingMutations.value.filter(
      (entry) => entry.todoId === todoId && isActivePendingMutationStatus(entry.status),
    )
  }

  function createDeleteEntry(optimisticTodo: Todo): PendingMutationEntry {
    const activeUserId = todoData.auth.activeUserId.value
    const intent = buildDeleteMutationIntent(optimisticTodo, activeUserId)

    return {
      mutationId: intent.mutationId,
      partitionKey: todoData.sync.controller.activePartitionKey.value,
      kind: intent.kind,
      todoId: optimisticTodo.id,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      optimisticTodo: null,
      intent,
    }
  }

  function createUpdateEntry(optimisticTodo: Todo): PendingMutationEntry {
    const activeUserId = todoData.auth.activeUserId.value
    const intent = activeUserId
      ? buildAuthenticatedUpdateIntent(optimisticTodo, activeUserId)
      : buildGuestMutationIntent(optimisticTodo, 'update')

    return {
      mutationId: intent.mutationId,
      partitionKey: todoData.sync.controller.activePartitionKey.value,
      kind: intent.kind,
      todoId: optimisticTodo.id,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      optimisticTodo,
      intent,
    }
  }

  function createPendingEntry(optimisticTodo: Todo, kindHint?: 'create' | 'update' | 'delete') {
    const activeUserId = todoData.auth.activeUserId.value
    const confirmedTodo = getConfirmedTodo(optimisticTodo.id)
    const intent = activeUserId
      ? buildTodoMutationIntent({
          todo: optimisticTodo,
          remoteTodo: confirmedTodo,
          activeUserId,
          fallbackDeviceId: getCurrentDeviceId(),
        })
      : buildGuestMutationIntent(
          optimisticTodo,
          kindHint ??
            (confirmedTodo ? (optimisticTodo.deletedAt === null ? 'update' : 'delete') : 'create'),
        )

    return {
      mutationId: intent.mutationId,
      partitionKey: todoData.sync.controller.activePartitionKey.value,
      kind: intent.kind,
      todoId: optimisticTodo.id,
      status: 'queued' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      optimisticTodo,
      intent,
    }
  }

  async function sendPendingMutation(
    reference: Pick<PendingMutationEntry, 'partitionKey' | 'mutationId'>,
  ) {
    if (!todoData.sync.controller.transportState.value.canSend) {
      return false
    }

    const entry = todoData.sync.controller.pendingMutations.value.find(
      (candidate) => getPendingReferenceKey(candidate) === getPendingReferenceKey(reference),
    )

    if (!entry || !['queued', 'retryable-error'].includes(entry.status)) {
      return false
    }

    if (
      entry.kind !== 'create' &&
      !getConfirmedTodo(entry.todoId) &&
      getActivePendingMutations(entry.todoId).some(
        (candidate) =>
          candidate.mutationId !== entry.mutationId && isBlockingPendingCreate(candidate),
      )
    ) {
      return false
    }

    todoData.sync.controller.markMutationSending(reference)

    let accepted

    try {
      accepted = await submitTodoMutation(getSupabaseClient(), entry.intent)

      if (!todoData.sync.controller.getPendingMutation(reference)) {
        return false
      }

      todoData.sync.controller.acceptMutation(reference, accepted)
    } catch (error) {
      if (!todoData.sync.controller.getPendingMutation(reference)) {
        return false
      }

      const message = error instanceof Error ? error.message : 'Todo mutation failed'

      if (error instanceof TodoMutationSubmitError && error.kind === 'auth') {
        todoData.sync.controller.markMutationRequiresReauth(reference, message)
        return false
      }

      todoData.sync.controller.markMutationRetryableError(reference, message)
      return false
    }

    try {
      const confirmedTodosCollection = getConfirmedTodosCollection()
      const txidForConfirmation = accepted.txid as unknown as Parameters<
        typeof confirmedTodosCollection.utils.awaitTxId
      >[0]

      await confirmedTodosCollection.utils.awaitTxId(txidForConfirmation)

      if (!todoData.sync.controller.getPendingMutation(reference)) {
        return false
      }

      todoData.sync.controller.confirmTxid(accepted.txid)
      todoData.sync.controller.reconcileWithConfirmedTodos(todoData.readModel.confirmedTodos.value)
      return true
    } catch {
      if (!todoData.sync.controller.getPendingMutation(reference)) {
        return false
      }

      return false
    }
  }

  async function flushPendingMutations() {
    const sendableMutations = todoData.sync.controller.pendingMutations.value.filter((entry) =>
      ['queued', 'retryable-error'].includes(entry.status),
    )

    if (sendableMutations.length === 0) {
      return true
    }

    let allDelivered = true

    for (const entry of sendableMutations) {
      const delivered = await sendPendingMutation(entry)
      allDelivered = allDelivered && delivered
    }

    return allDelivered
  }

  function queueMutation(entry: PendingMutationEntry, shouldDispatch = true) {
    const reference = todoData.sync.controller.recordPendingMutation(entry)

    if (shouldDispatch) {
      void sendPendingMutation(reference)
    }

    return reference
  }

  function replaceMutation(
    reference: PendingMutationReference,
    nextEntry: PendingMutationEntry,
    shouldDispatch = true,
  ) {
    const nextReference = todoData.sync.controller.replacePendingMutation(reference, nextEntry)

    if (shouldDispatch) {
      void sendPendingMutation(nextReference)
    }

    return nextReference
  }

  function createTodo(label: string, weekNumber: number | null) {
    const now = Date.now()
    const optimisticTodo: Todo = {
      id: crypto.randomUUID(),
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deviceId: getCurrentDeviceId(),
      userId: todoData.auth.activeUserId.value,
      deletedAt: null,
    }

    queueMutation(createPendingEntry(optimisticTodo, 'create'))
    return optimisticTodo.id
  }

  function updateTodo(id: string, updates: TodoUpdates) {
    const existingTodo = todoData.readModel.todos.value.find((todo) => todo.id === id)

    if (!existingTodo) {
      throw new Error(`Cannot update todo ${id} because it does not exist in the merged read model`)
    }

    const optimisticTodo = buildOptimisticTodo(existingTodo, updates)
    const confirmedTodo = getConfirmedTodo(id)
    const activePendingMutations = getActivePendingMutations(id)
    const pendingCreate = activePendingMutations.find((entry) => entry.kind === 'create')

    if (!confirmedTodo && pendingCreate && isCancelablePendingCreate(pendingCreate)) {
      replaceMutation(pendingCreate, createPendingEntry(optimisticTodo, 'create'))
      return
    }

    if (!confirmedTodo && pendingCreate && isBlockingPendingCreate(pendingCreate)) {
      const pendingFollowUpUpdate = [...activePendingMutations]
        .reverse()
        .find(
          (entry) =>
            entry.kind === 'update' && ['queued', 'retryable-error'].includes(entry.status),
        )

      if (pendingFollowUpUpdate) {
        replaceMutation(pendingFollowUpUpdate, createUpdateEntry(optimisticTodo), false)
        return
      }

      queueMutation(createUpdateEntry(optimisticTodo), false)
      return
    }

    queueMutation(createPendingEntry(optimisticTodo, 'update'))
  }

  function deleteTodo(id: string) {
    const existingTodo = todoData.readModel.todos.value.find((todo) => todo.id === id)

    if (!existingTodo) {
      throw new Error(`Cannot delete todo ${id} because it does not exist in the merged read model`)
    }

    const deletedTodo = buildOptimisticTodo(existingTodo, { deletedAt: Date.now() })
    const confirmedTodo = getConfirmedTodo(id)
    const activePendingMutations = getActivePendingMutations(id)
    const pendingCreate = activePendingMutations.find((entry) => entry.kind === 'create')
    const pendingMutation = [...activePendingMutations].reverse()[0]

    if (!confirmedTodo && todoData.auth.activeUserId.value === null) {
      for (const mutation of activePendingMutations) {
        todoData.sync.controller.removePendingMutation(mutation)
      }

      return
    }

    if (!confirmedTodo && pendingCreate && isCancelablePendingCreate(pendingCreate)) {
      todoData.sync.controller.removePendingMutation(pendingCreate)
      return
    }

    const deleteEntry = createDeleteEntry(deletedTodo)

    if (!confirmedTodo && pendingCreate && isBlockingPendingCreate(pendingCreate)) {
      const pendingFollowUpMutation = [...activePendingMutations]
        .reverse()
        .find(
          (entry) =>
            entry.mutationId !== pendingCreate.mutationId &&
            ['queued', 'retryable-error'].includes(entry.status),
        )

      if (pendingFollowUpMutation) {
        replaceMutation(pendingFollowUpMutation, deleteEntry, false)
        return
      }

      queueMutation(deleteEntry, false)
      return
    }

    if (pendingMutation) {
      replaceMutation(pendingMutation, deleteEntry)
      return
    }

    queueMutation(deleteEntry)
  }

  function restoreTodo(id: string) {
    updateTodo(id, { deletedAt: null })
  }

  return {
    createTodo,
    deleteTodo,
    flushPendingMutations,
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
