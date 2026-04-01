import type { PostgrestError } from '@supabase/supabase-js'

import { parseTodoMutationIntent, parseTodoMutationResponse } from './todo-mutation-contract'
import type { TodoMutationIntent, TodoMutationResponse } from './todo-mutation-contract'

export type SyncTodo = {
  id: string
  label: string
  weekNumber: number | null
  done: boolean
  archived: boolean
  createdAt: number
  updatedAt: number
  deviceId: string | null
  deletedAt: number | null
  userId: string | null
}

export type RemoteTodoRow = {
  id: string
  label: string
  week_number: number | null
  done: boolean
  archived: boolean
  created_at: number
  updated_at: number
  device_id: string
  deleted_at: number | null
  user_id: string
}

type SyncTodoWithOwner = Pick<
  SyncTodo,
  | 'id'
  | 'label'
  | 'weekNumber'
  | 'done'
  | 'archived'
  | 'createdAt'
  | 'updatedAt'
  | 'deviceId'
  | 'deletedAt'
  | 'userId'
>

type TodoMutationRpcClient = {
  rpc: (
    fn: 'apply_todo_mutation',
    args: { intent: TodoMutationIntent },
  ) => PromiseLike<{ data: unknown; error: PostgrestError | null }>
}

export function shouldPushTodoForUser(
  todo: Pick<SyncTodo, 'userId'>,
  activeUserId: string | null,
): boolean {
  return activeUserId !== null && todo.userId === activeUserId
}

export function shouldWriteTodoToRemote(
  todo: SyncTodoWithOwner,
  remoteTodo: SyncTodo | undefined,
  activeUserId: string | null,
): boolean {
  if (!shouldPushTodoForUser(todo, activeUserId)) {
    return false
  }

  if (!remoteTodo) {
    return todo.deletedAt === null
  }

  return todo.updatedAt > remoteTodo.updatedAt
}

export function buildRemoteTodoRow(todo: SyncTodo, fallbackDeviceId: string): RemoteTodoRow {
  if (!todo.userId) {
    throw new Error(`Cannot build a remote todo row without an authenticated owner`)
  }

  return {
    id: todo.id,
    label: todo.label,
    week_number: todo.weekNumber,
    done: todo.done,
    archived: todo.archived,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    device_id: todo.deviceId || fallbackDeviceId,
    deleted_at: todo.deletedAt,
    user_id: todo.userId,
  }
}

type BuildTodoMutationIntentOptions = {
  todo: SyncTodoWithOwner
  remoteTodo: SyncTodo | undefined
  activeUserId: string
}

function getTodoMutationKind(todo: SyncTodoWithOwner, remoteTodo: SyncTodo | undefined) {
  if (!remoteTodo) {
    return 'create' as const
  }

  if (todo.deletedAt !== null) {
    return 'delete' as const
  }

  return 'update' as const
}

function getMutationIdentitySegments(
  kind: ReturnType<typeof getTodoMutationKind>,
  todo: SyncTodoWithOwner,
) {
  if (kind === 'create') {
    return [String(todo.createdAt)]
  }

  if (kind === 'delete') {
    return [String(todo.updatedAt), String(todo.deletedAt)]
  }

  return [String(todo.updatedAt)]
}

export function deriveTodoMutationId({
  todo,
  remoteTodo,
  activeUserId,
}: BuildTodoMutationIntentOptions): string {
  if (!shouldPushTodoForUser(todo, activeUserId)) {
    throw new Error('Cannot derive a todo mutation id for a todo outside the active user scope')
  }

  const mutationKind = getTodoMutationKind(todo, remoteTodo)
  const identitySegments = getMutationIdentitySegments(mutationKind, todo)

  return ['todo-mutation', activeUserId, todo.id, mutationKind, ...identitySegments].join(':')
}

export function buildTodoMutationIntent({
  todo,
  remoteTodo,
  activeUserId,
  fallbackDeviceId,
}: BuildTodoMutationIntentOptions & { fallbackDeviceId: string }): TodoMutationIntent {
  if (!shouldPushTodoForUser(todo, activeUserId)) {
    throw new Error('Cannot build a todo mutation intent for a todo outside the active user scope')
  }

  const mutationId = deriveTodoMutationId({
    todo,
    remoteTodo,
    activeUserId,
  })
  const client = {
    deviceId: todo.deviceId || fallbackDeviceId,
  }

  const mutationKind = getTodoMutationKind(todo, remoteTodo)

  if (mutationKind === 'create') {
    return parseTodoMutationIntent({
      kind: 'create',
      mutationId,
      todoId: todo.id,
      user_id: activeUserId,
      client,
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

  if (mutationKind === 'delete') {
    return parseTodoMutationIntent({
      kind: 'delete',
      mutationId,
      todoId: todo.id,
      user_id: activeUserId,
      client,
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
    user_id: activeUserId,
    client,
    values: {
      label: todo.label,
      weekNumber: todo.weekNumber,
      done: todo.done,
      archived: todo.archived,
      deletedAt: null,
      updatedAt: todo.updatedAt,
    },
  })
}

export async function submitTodoMutation(
  supabase: TodoMutationRpcClient,
  intent: TodoMutationIntent,
): Promise<TodoMutationResponse> {
  const { data, error } = await supabase.rpc('apply_todo_mutation', { intent })

  if (error) {
    throw new Error(error.message)
  }

  return parseTodoMutationResponse(data)
}
