import type { Todo } from '@/db/collections'

const GUEST_STORAGE_KEY = 'ai-todo-app-todos-guest'
const ACCOUNT_STORAGE_KEY_PREFIX = 'ai-todo-app-todos-user:'
const MIGRATION_INPUT_STORAGE_KEY = 'ai-todo-app-migration-input:guest'

export type TodoMigrationStatus = 'none' | 'available' | 'promoting' | 'declined'

export type TodoMigrationState = {
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

type StagedTodoPromotionIdOptions = TodoStorageOptions & {
  createTodoId?: () => string
  stagedTodoId: string
}

type RemoveConfirmedPromotedStagedTodosOptions = TodoStorageOptions & {
  confirmedTodoIds: readonly string[]
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

function tryParseTodoList(input: unknown): Todo[] | null {
  try {
    return parseTodoList(input)
  } catch {
    return null
  }
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

function listLegacyAccountKeys(storage: Storage | null) {
  if (!storage) {
    return []
  }

  const keys: string[] = []

  for (let index = 0; index < storage.length; index += 1) {
    const storageKey = storage.key(index)

    if (storageKey?.startsWith(ACCOUNT_STORAGE_KEY_PREFIX)) {
      keys.push(storageKey)
    }
  }

  return keys
}

export function getGuestStorageKey(): string {
  return GUEST_STORAGE_KEY
}

export function getAccountStorageKey(userId: string): string {
  return `${ACCOUNT_STORAGE_KEY_PREFIX}${userId}`
}

export function getActiveStorageKey(userId: string | null): string {
  return userId ? getAccountStorageKey(userId) : getGuestStorageKey()
}

export function getMigrationInputStorageKey(): string {
  return MIGRATION_INPUT_STORAGE_KEY
}

export function readMigrationInputTodos(options: TodoStorageOptions = {}): Todo[] {
  const storage = resolveStorage(options.storage)
  return readStoredTodoMigrationState(storage).stagedTodos
}

export function readTodoMigrationState(options: TodoStorageOptions = {}): TodoMigrationState {
  return readStoredTodoMigrationState(resolveStorage(options.storage))
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

export function migrateLegacyBucketsToGuestMigrationInput(
  options: TodoStorageOptions = {},
): number {
  const storage = resolveStorage(options.storage)

  if (!storage) {
    return 0
  }

  const legacyBucketKeys = [GUEST_STORAGE_KEY, ...listLegacyAccountKeys(storage)]
  const migratedLegacyBucketKeys: string[] = []
  const legacyTodos = legacyBucketKeys.flatMap((storageKey) => {
    const parsedTodos = tryParseTodoList(storage.getItem(storageKey) ?? null)

    if (!parsedTodos) {
      return []
    }

    migratedLegacyBucketKeys.push(storageKey)
    return parsedTodos
  })

  if (legacyTodos.length === 0) {
    return readMigrationInputTodos({ storage }).length
  }

  const existingState = readStoredTodoMigrationState(storage)
  const mergedTodos = mergeTodos(existingState.stagedTodos, legacyTodos)
  writeTodoMigrationState(storage, {
    ...existingState,
    stagedTodos: mergedTodos,
  })

  for (const storageKey of migratedLegacyBucketKeys) {
    storage.removeItem(storageKey)
  }

  emitMigrationInputChanged()
  return mergedTodos.length
}

export function subscribeToMigrationInputChanges(listener: () => void) {
  migrationInputListeners.add(listener)

  return () => {
    migrationInputListeners.delete(listener)
  }
}

export function ensureStagedTodoPromotionId({
  createTodoId = () => crypto.randomUUID(),
  stagedTodoId,
  storage: providedStorage,
}: StagedTodoPromotionIdOptions) {
  const storage = resolveStorage(providedStorage)
  const state = readStoredTodoMigrationState(storage)

  if (!state.stagedTodos.some((todo) => todo.id === stagedTodoId)) {
    throw new Error(`Cannot promote unknown staged todo ${stagedTodoId}`)
  }

  const existingPromotedTodoId = state.promotedTodoIdsBySourceId[stagedTodoId]

  if (existingPromotedTodoId) {
    return existingPromotedTodoId
  }

  const promotedTodoId = createTodoId()
  writeTodoMigrationState(storage, {
    ...state,
    promotedTodoIdsBySourceId: {
      ...state.promotedTodoIdsBySourceId,
      [stagedTodoId]: promotedTodoId,
    },
  })
  emitMigrationInputChanged()
  return promotedTodoId
}

export function markStagedMigrationPromoting(options: TodoStorageOptions = {}) {
  const storage = resolveStorage(options.storage)
  const state = readStoredTodoMigrationState(storage)

  if (state.status === 'none' || state.status === 'declined') {
    return false
  }

  writeTodoMigrationState(storage, {
    ...state,
    status: 'promoting',
  })
  emitMigrationInputChanged()
  return true
}

export function declineStagedMigrationTodos(options: TodoStorageOptions = {}) {
  const storage = resolveStorage(options.storage)
  const state = readStoredTodoMigrationState(storage)

  if (state.status === 'none') {
    return false
  }

  writeTodoMigrationState(storage, {
    ...state,
    status: 'declined',
  })
  emitMigrationInputChanged()
  return true
}

export function removeConfirmedPromotedStagedTodos({
  confirmedTodoIds,
  storage: providedStorage,
}: RemoveConfirmedPromotedStagedTodosOptions) {
  if (confirmedTodoIds.length === 0) {
    return 0
  }

  const storage = resolveStorage(providedStorage)
  const state = readStoredTodoMigrationState(storage)
  const confirmedTodoIdSet = new Set(confirmedTodoIds)
  const removedTodoIds = new Set(
    Object.entries(state.promotedTodoIdsBySourceId)
      .filter(([, promotedTodoId]) => confirmedTodoIdSet.has(promotedTodoId))
      .map(([stagedTodoId]) => stagedTodoId),
  )

  if (removedTodoIds.size === 0) {
    return 0
  }

  writeTodoMigrationState(storage, {
    ...state,
    promotedTodoIdsBySourceId: Object.fromEntries(
      Object.entries(state.promotedTodoIdsBySourceId).filter(
        ([stagedTodoId]) => !removedTodoIds.has(stagedTodoId),
      ),
    ),
    stagedTodos: state.stagedTodos.filter((todo) => !removedTodoIds.has(todo.id)),
  })
  emitMigrationInputChanged()
  return removedTodoIds.size
}
