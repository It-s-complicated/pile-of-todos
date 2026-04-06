import type { PostgrestError } from '@supabase/supabase-js'

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
  device_id: string | null
  deleted_at: number | null
  user_id: string
}

export class TodoRemoteWriteError extends Error {
  readonly kind: 'auth' | 'not-found' | 'retryable'

  constructor(message: string, kind: 'auth' | 'not-found' | 'retryable') {
    super(message)
    this.name = 'TodoRemoteWriteError'
    this.kind = kind
  }
}

type TodoTableClient = {
  from: (table: 'todos') => any
}

function isAuthRelatedPostgrestError(error: PostgrestError): boolean {
  const authFailureCodes = new Set(['401', '403', '42501', 'PGRST301', 'PGRST302'])
  const authFailureDetails = [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()

  if (error.code && authFailureCodes.has(error.code)) {
    return true
  }

  return [
    'jwt',
    'session',
    'token',
    'auth',
    'row-level security',
    'rls',
    'permission denied',
    'not found for the authenticated user',
  ].some((signal) => authFailureDetails.includes(signal))
}

function createTodoWriteError(error: PostgrestError) {
  if (isAuthRelatedPostgrestError(error)) {
    return new TodoRemoteWriteError(error.message, 'auth')
  }

  return new TodoRemoteWriteError(error.message, 'retryable')
}

export function buildRemoteTodoRow(
  todo: SyncTodo,
  activeUserId: string,
  fallbackDeviceId: string,
): RemoteTodoRow {
  const userId = todo.userId ?? activeUserId

  if (userId !== activeUserId) {
    throw new Error('Cannot build a remote todo row outside the active user scope')
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
    user_id: userId,
  }
}

export function translateRemoteTodoRow(todo: RemoteTodoRow): SyncTodo {
  return {
    id: todo.id,
    label: todo.label,
    weekNumber: todo.week_number,
    done: todo.done,
    archived: todo.archived,
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
    deviceId: todo.device_id,
    deletedAt: todo.deleted_at,
    userId: todo.user_id,
  }
}

export async function upsertRemoteTodo(
  supabase: TodoTableClient,
  row: RemoteTodoRow,
): Promise<SyncTodo> {
  const { data, error } = await supabase
    .from('todos')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    throw createTodoWriteError(error)
  }

  return translateRemoteTodoRow(data)
}

type UpdateRemoteTodoOptions = {
  activeUserId: string
  todoId: string
  updates: {
    archived?: boolean
    deletedAt?: number | null
    deviceId?: string | null
    done?: boolean
    label?: string
    updatedAt: number
    weekNumber?: number | null
  }
}

export async function updateRemoteTodo(
  supabase: TodoTableClient,
  options: UpdateRemoteTodoOptions,
): Promise<SyncTodo> {
  const updateValues: Partial<RemoteTodoRow> = {
    updated_at: options.updates.updatedAt,
  }

  if (options.updates.label !== undefined) {
    updateValues.label = options.updates.label
  }

  if (options.updates.weekNumber !== undefined) {
    updateValues.week_number = options.updates.weekNumber
  }

  if (options.updates.done !== undefined) {
    updateValues.done = options.updates.done
  }

  if (options.updates.archived !== undefined) {
    updateValues.archived = options.updates.archived
  }

  if (options.updates.deletedAt !== undefined) {
    updateValues.deleted_at = options.updates.deletedAt
  }

  if (options.updates.deviceId !== undefined) {
    updateValues.device_id = options.updates.deviceId ?? null
  }

  const { data, error } = await supabase
    .from('todos')
    .update(updateValues)
    .eq('id', options.todoId)
    .eq('user_id', options.activeUserId)
    .select()
    .maybeSingle()

  if (error) {
    throw createTodoWriteError(error)
  }

  if (!data) {
    throw new TodoRemoteWriteError('Todo was not found for the approved account', 'not-found')
  }

  return translateRemoteTodoRow(data)
}
