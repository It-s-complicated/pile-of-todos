import type { Todo } from '@/db/collections'

const MIGRATION_INPUT_STORAGE_KEY = 'ai-todo-app-migration-input:guest'

type TodoMigrationStatus = 'none' | 'available' | 'promoting' | 'declined'

type TodoMigrationState = {
  status: TodoMigrationStatus
  stagedTodos: Todo[]
  promotedTodoIdsBySourceId: Record<string, string>
}

type TodoStorageOptions = {
  storage?: Storage | null
}

type StageImportedTodosOptions = TodoStorageOptions & {
  todos: readonly unknown[]
}

type StagedMigrationInputResult = {
  addedCount: number
  totalCount: number
}

const migrationInputListeners = new Set<() => void>()

function getBrowserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function resolveStorage(storage: Storage | null | undefined) {
  return storage === undefined ? getBrowserStorage() : storage
}

function emitMigrationInputChanged() {
  migrationInputListeners.forEach((listener) => listener())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNumberField(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Todo ${fieldName} must be a number`)
  }

  return value
}

function parseNullableNumberField(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null
  }

  return parseNumberField(value, fieldName)
}

function parseNullableStringField(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`Todo ${fieldName} must be a string or null`)
  }

  return value
}

function parseTodo(input: unknown): Todo {
  if (!isRecord(input)) {
    throw new Error('Todo must be an object')
  }

  if (typeof input.id !== 'string' || input.id.length === 0) {
    throw new Error('Todo id must be a non-empty string')
  }

  if (typeof input.label !== 'string' || input.label.length === 0) {
    throw new Error('Todo label must be a non-empty string')
  }

  if (typeof input.done !== 'boolean') {
    throw new Error('Todo done must be a boolean')
  }

  if (typeof input.archived !== 'boolean') {
    throw new Error('Todo archived must be a boolean')
  }

  return {
    id: input.id,
    label: input.label,
    weekNumber: parseNullableNumberField(input.weekNumber, 'weekNumber'),
    done: input.done,
    archived: input.archived,
    createdAt: parseNumberField(input.createdAt, 'createdAt'),
    updatedAt: parseNumberField(input.updatedAt, 'updatedAt'),
    deviceId: parseNullableStringField(input.deviceId, 'deviceId'),
    userId: parseNullableStringField(input.userId, 'userId'),
    deletedAt: parseNullableNumberField(input.deletedAt, 'deletedAt'),
  }
}

function normalizeMigrationInputTodo(input: unknown): Todo {
  const todo = parseTodo(input)

  return {
    ...todo,
    userId: null,
  }
}

function createEmptyTodoMigrationState(): TodoMigrationState {
  return {
    promotedTodoIdsBySourceId: {},
    stagedTodos: [],
    status: 'none',
  }
}

function isTodoMigrationStatus(value: unknown): value is Exclude<TodoMigrationStatus, 'none'> {
  return value === 'available' || value === 'promoting' || value === 'declined'
}

function parsePromotedTodoIdsBySourceId(input: unknown): Record<string, string> {
  if (!isRecord(input)) {
    return {}
  }

  return Object.entries(input).reduce<Record<string, string>>(
    (promotedTodoIdsBySourceId, entry) => {
      const [stagedTodoId, promotedTodoId] = entry

      if (typeof promotedTodoId !== 'string' || promotedTodoId.length === 0) {
        return promotedTodoIdsBySourceId
      }

      promotedTodoIdsBySourceId[stagedTodoId] = promotedTodoId
      return promotedTodoIdsBySourceId
    },
    {},
  )
}

function normalizeTodoMigrationState(
  state: Omit<TodoMigrationState, 'status'> & { status: TodoMigrationStatus },
) {
  if (state.stagedTodos.length === 0) {
    return createEmptyTodoMigrationState()
  }

  if (state.status === 'none') {
    return {
      ...state,
      status: 'available' as const,
    }
  }

  return state
}

function parseTodoMigrationState(input: unknown): TodoMigrationState {
  if (input === null || input === undefined || input === '') {
    return createEmptyTodoMigrationState()
  }

  const parsed = typeof input === 'string' ? (JSON.parse(input) as unknown) : input

  if (Array.isArray(parsed)) {
    return normalizeTodoMigrationState({
      promotedTodoIdsBySourceId: {},
      stagedTodos: parsed.map((entry) => normalizeMigrationInputTodo(entry)),
      status: 'available',
    })
  }

  if (!isRecord(parsed)) {
    throw new Error('Todo migration storage must contain an array or object state')
  }

  return normalizeTodoMigrationState({
    promotedTodoIdsBySourceId: parsePromotedTodoIdsBySourceId(parsed.promotedTodoIdsBySourceId),
    stagedTodos: parseTodoList(parsed.stagedTodos),
    status: isTodoMigrationStatus(parsed.status) ? parsed.status : 'none',
  })
}

function readStoredTodoMigrationState(storage: Storage | null): TodoMigrationState {
  try {
    return parseTodoMigrationState(storage?.getItem(MIGRATION_INPUT_STORAGE_KEY) ?? null)
  } catch {
    return createEmptyTodoMigrationState()
  }
}

function writeTodoMigrationState(storage: Storage | null, state: TodoMigrationState) {
  if (!storage) {
    return
  }

  const normalizedState = normalizeTodoMigrationState(state)

  if (normalizedState.status === 'none') {
    storage.removeItem(MIGRATION_INPUT_STORAGE_KEY)
    return
  }

  storage.setItem(MIGRATION_INPUT_STORAGE_KEY, JSON.stringify(normalizedState))
}

function parseTodoList(input: unknown): Todo[] {
  if (input === null || input === undefined || input === '') {
    return []
  }

  const parsed = typeof input === 'string' ? (JSON.parse(input) as unknown) : input

  if (!Array.isArray(parsed)) {
    throw new Error('Todo storage must contain an array of todos')
  }

  return parsed.map((entry) => normalizeMigrationInputTodo(entry))
}

function mergeTodos(existingTodos: Todo[], incomingTodos: Todo[]) {
  const mergedTodos = [...existingTodos]
  const todoIndexes = new Map(mergedTodos.map((todo, index) => [todo.id, index]))

  for (const todo of incomingTodos) {
    const existingIndex = todoIndexes.get(todo.id)

    if (existingIndex === undefined) {
      todoIndexes.set(todo.id, mergedTodos.length)
      mergedTodos.push(todo)
      continue
    }

    if (todo.updatedAt >= mergedTodos[existingIndex]!.updatedAt) {
      mergedTodos[existingIndex] = todo
    }
  }

  return mergedTodos
}

export function stageImportedTodosAsMigrationInput({
  storage: providedStorage,
  todos,
}: StageImportedTodosOptions): StagedMigrationInputResult {
  const storage = resolveStorage(providedStorage)
  const existingState = readStoredTodoMigrationState(storage)
  const nextTodos = mergeTodos(existingState.stagedTodos, parseTodoList(todos))

  writeTodoMigrationState(storage, {
    ...existingState,
    stagedTodos: nextTodos,
  })
  emitMigrationInputChanged()

  return {
    addedCount: nextTodos.length - existingState.stagedTodos.length,
    totalCount: nextTodos.length,
  }
}
