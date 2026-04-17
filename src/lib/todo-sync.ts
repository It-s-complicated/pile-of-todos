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

type RemoteTodoRow = {
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

export type TodoMutationKind = 'create' | 'update' | 'delete'

export type TodoMutationValues = {
  archived?: boolean
  createdAt?: number
  deletedAt?: number | null
  done?: boolean
  label?: string
  updatedAt: number
  weekNumber?: number | null
}

type TodoMutationIntent = {
  client: {
    deviceId: string | null
  }
  kind: TodoMutationKind
  mutationId: string
  todoId: string
  values: TodoMutationValues
}

export type AcceptedTodoMutation = {
  mutationId: string
  todoId: string
  txid: number
}

type TodoMutationRpcError = {
  code?: string
  details?: string | null
  hint?: string | null
  message: string
}

type TodoMutationRpcResponse = {
  data: unknown
  error: TodoMutationRpcError | null
}

type TodoMutationRpcClient = {
  rpc: (
    functionName: 'apply_todo_mutation',
    params: {
      intent: TodoMutationIntent
    },
  ) => PromiseLike<TodoMutationRpcResponse>
}

export class TodoRemoteWriteError extends Error {
  readonly kind: 'auth' | 'not-found' | 'retryable'

  constructor(message: string, kind: 'auth' | 'not-found' | 'retryable') {
    super(message)
    this.name = 'TodoRemoteWriteError'
    this.kind = kind
  }
}

function getNormalizedPostgrestText(error: TodoMutationRpcError) {
  return [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()
}

function isAuthRelatedPostgrestError(error: TodoMutationRpcError): boolean {
  const authFailureCodes = new Set(['401', '403', '42501', 'PGRST301', 'PGRST302'])
  const authFailureDetails = getNormalizedPostgrestText(error)

  if (error.code && authFailureCodes.has(error.code)) {
    return true
  }

  return ['jwt', 'session', 'token', 'auth', 'row-level security', 'rls', 'permission denied'].some(
    (signal) => authFailureDetails.includes(signal),
  )
}

function isTodoNotFoundPostgrestError(error: TodoMutationRpcError): boolean {
  const details = getNormalizedPostgrestText(error)

  return [
    'todo was not found for the approved account',
    'todo was not found for the authenticated user',
    'not found for the approved account',
    'not found for the authenticated user',
    'was not found for the authenticated user',
  ].some((signal) => details.includes(signal))
}

function createTodoWriteError(error: TodoMutationRpcError) {
  if (isTodoNotFoundPostgrestError(error)) {
    return new TodoRemoteWriteError(error.message, 'not-found')
  }

  if (isAuthRelatedPostgrestError(error)) {
    return new TodoRemoteWriteError(error.message, 'auth')
  }

  return new TodoRemoteWriteError(error.message, 'retryable')
}

function buildTodoMutationIntent(
  kind: TodoMutationKind,
  todoId: string,
  values: TodoMutationValues,
  deviceId: string | null,
  mutationId: string = crypto.randomUUID(),
): TodoMutationIntent {
  return {
    client: {
      deviceId,
    },
    kind,
    mutationId,
    todoId,
    values,
  }
}

function parseTxid(input: unknown): number {
  if (typeof input === 'number' && Number.isInteger(input) && input >= 0) {
    return input
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    const txid = Number.parseInt(input, 10)

    if (Number.isInteger(txid) && txid >= 0) {
      return txid
    }
  }

  throw new Error('Todo mutation RPC response did not include a valid txid')
}

function parseAcceptedTodoMutation(
  data: unknown,
  fallback: Pick<AcceptedTodoMutation, 'mutationId' | 'todoId'>,
): AcceptedTodoMutation {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Todo mutation RPC response was missing accepted mutation data')
  }

  const mutationIdValue = (data as { mutationId?: unknown }).mutationId
  const todoIdValue = (data as { todoId?: unknown }).todoId
  const mutationId =
    typeof mutationIdValue === 'string' && mutationIdValue.trim().length > 0
      ? mutationIdValue
      : fallback.mutationId
  const todoId =
    typeof todoIdValue === 'string' && todoIdValue.trim().length > 0 ? todoIdValue : fallback.todoId

  return {
    mutationId,
    todoId,
    txid: parseTxid((data as { txid?: unknown }).txid),
  }
}

async function applyRemoteTodoMutation(
  supabase: TodoMutationRpcClient,
  intent: TodoMutationIntent,
): Promise<AcceptedTodoMutation> {
  const { data, error } = await supabase.rpc('apply_todo_mutation', { intent })

  if (error) {
    throw createTodoWriteError(error)
  }

  return parseAcceptedTodoMutation(data, {
    mutationId: intent.mutationId,
    todoId: intent.todoId,
  })
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

export async function upsertRemoteTodo(
  supabase: TodoMutationRpcClient,
  row: RemoteTodoRow,
  options: {
    mutationId?: string
  } = {},
): Promise<AcceptedTodoMutation> {
  return applyRemoteTodoMutation(
    supabase,
    buildTodoMutationIntent(
      'create',
      row.id,
      {
        archived: row.archived,
        createdAt: row.created_at,
        deletedAt: row.deleted_at,
        done: row.done,
        label: row.label,
        updatedAt: row.updated_at,
        weekNumber: row.week_number,
      },
      row.device_id,
      options.mutationId,
    ),
  )
}

type UpdateRemoteTodoOptions = {
  activeUserId: string
  kind?: Extract<TodoMutationKind, 'delete' | 'update'>
  mutationId?: string
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
  supabase: TodoMutationRpcClient,
  options: UpdateRemoteTodoOptions,
): Promise<AcceptedTodoMutation> {
  const values: TodoMutationValues = {
    updatedAt: options.updates.updatedAt,
  }

  if (options.updates.label !== undefined) {
    values.label = options.updates.label
  }

  if (options.updates.weekNumber !== undefined) {
    values.weekNumber = options.updates.weekNumber
  }

  if (options.updates.done !== undefined) {
    values.done = options.updates.done
  }

  if (options.updates.archived !== undefined) {
    values.archived = options.updates.archived
  }

  if (options.updates.deletedAt !== undefined) {
    values.deletedAt = options.updates.deletedAt
  }

  return applyRemoteTodoMutation(
    supabase,
    buildTodoMutationIntent(
      options.kind ?? 'update',
      options.todoId,
      values,
      options.updates.deviceId ?? null,
      options.mutationId,
    ),
  )
}
