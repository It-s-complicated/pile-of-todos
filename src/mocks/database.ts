import type { ConfirmedTodoRow } from '@/db/confirmed-todos'
import { addWeeks, getCurrentWeekKey } from '@/lib/weeks'

/**
 * In-memory stand-in for the Postgres `todos` table and the
 * `apply_todo_mutation` RPC (see `src/db/out/0009_harden_todo_mutation_rpc.sql`).
 * State is persisted to localStorage so reloads keep your mock data.
 */

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type LedgerEntry = { todoId: string; txid: string; userId: string }

type DatabaseState = {
  ledger: Record<string, LedgerEntry>
  todos: ConfirmedTodoRow[]
  txid: number
}

type MutationIntent = {
  client?: { deviceId?: string | null }
  kind?: string
  mutationId?: string
  todoId?: string
  values?: Record<string, unknown>
}

export type AcceptedMutation = { mutationId: string; todoId: string; txid: string }

/** Mirrors a Postgres error as PostgREST would report it. */
export class PostgrestMockError extends Error {
  readonly code: 'PT400' | 'P0001'

  constructor(message: string, code: 'PT400' | 'P0001' = 'PT400') {
    super(message)
    this.code = code
  }
}

const STORAGE_KEY = 'pile-of-todos:mock-database'
const LABEL_PATTERN = /^[a-z0-9\s.,!@+#$%&*'()?-]+$/i
const MAX_TIMESTAMP_MS = 253_402_300_799_999
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function seedTodos(userId: string): ConfirmedTodoRow[] {
  const thisWeek = getCurrentWeekKey()
  const now = Date.now()
  const seeds: Array<[label: string, week: number | null, done?: boolean]> = [
    ['Plan the week', thisWeek, true],
    ['Renew passport photos', thisWeek],
    ['Fix bike brakes', thisWeek],
    ['Reply to Anna', addWeeks(thisWeek, -1)],
    ['Prepare tax documents', addWeeks(thisWeek, 1)],
    ['Plan holiday gifts', addWeeks(thisWeek, 4)],
    ['Learn sourdough', null],
    ['Sort out old photos', null],
  ]

  return seeds.map(([label, weekNumber, done = false], index) => ({
    id: crypto.randomUUID(),
    label,
    week_number: weekNumber,
    done,
    archived: false,
    created_at: now - (seeds.length - index) * 60_000,
    updated_at: now - (seeds.length - index) * 60_000,
    device_id: 'mock',
    user_id: userId,
    deleted_at: null,
  }))
}

function readTimestamp(values: Record<string, unknown>, key: string): number | null | undefined {
  if (!(key in values) || values[key] === null) {
    return values[key] === null ? null : undefined
  }

  const value = values[key]

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new PostgrestMockError(`${key} must be epoch milliseconds`)
  }

  if (value > MAX_TIMESTAMP_MS) {
    throw new PostgrestMockError(`${key} is out of range`)
  }

  return value
}

export function createMockDatabase(storage: KeyValueStorage | null, seedUserId: string) {
  function load(): DatabaseState {
    const stored = storage?.getItem(STORAGE_KEY)

    if (stored) {
      try {
        return JSON.parse(stored) as DatabaseState
      } catch {
        // Corrupt mock data: fall through and reseed.
      }
    }

    return { ledger: {}, todos: seedTodos(seedUserId), txid: 1 }
  }

  let state = load()

  function save() {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  function accept(mutationId: string, todoId: string, userId: string): AcceptedMutation {
    state.txid += 1
    const entry = { todoId, txid: String(state.txid), userId }
    state.ledger[mutationId] = entry
    return { mutationId, todoId, txid: entry.txid }
  }

  function findOwnTodo(todoId: string, userId: string) {
    const todo = state.todos.find((row) => row.id === todoId && row.user_id === userId)

    if (!todo) {
      throw new PostgrestMockError(
        `todo ${todoId} was not found for the authenticated user`,
        'P0001',
      )
    }

    return todo
  }

  function applyTodoMutation(intent: MutationIntent, userId: string | null): AcceptedMutation {
    if (!userId) {
      throw new PostgrestMockError('apply_todo_mutation requires an authenticated user', 'P0001')
    }

    const mutationId = intent.mutationId ?? ''
    const todoId = intent.todoId ?? ''
    const values = intent.values ?? {}
    const deviceId = intent.client?.deviceId || null

    if (!mutationId) throw new PostgrestMockError('apply_todo_mutation requires mutationId')
    if (!todoId) throw new PostgrestMockError('apply_todo_mutation requires todoId')
    if (!UUID_PATTERN.test(todoId)) throw new PostgrestMockError('todoId must be a UUID')

    const label = typeof values.label === 'string' ? values.label.trim() : ''

    if ('label' in values && (!label || label.length > 500 || !LABEL_PATTERN.test(label))) {
      throw new PostgrestMockError('label must contain 1 to 500 supported characters')
    }

    const createdAt = readTimestamp(values, 'createdAt')
    const updatedAt = readTimestamp(values, 'updatedAt')
    const deletedAt = readTimestamp(values, 'deletedAt')

    // Idempotent replay: the same mutation id returns the original acceptance.
    const existing = state.ledger[mutationId]
    if (existing) {
      if (existing.userId !== userId) {
        throw new PostgrestMockError(
          `mutationId ${mutationId} is already claimed for another user`,
          'P0001',
        )
      }

      return { mutationId, todoId: existing.todoId, txid: existing.txid }
    }

    if (intent.kind === 'create') {
      if (!label) throw new PostgrestMockError('create intent requires a non-empty label')
      if (typeof values.done !== 'boolean' || typeof values.archived !== 'boolean') {
        throw new PostgrestMockError('create intent requires done and archived flags')
      }
      if (createdAt == null || updatedAt == null) {
        throw new PostgrestMockError('create intent requires createdAt and updatedAt')
      }
      if (state.todos.some((row) => row.id === todoId)) {
        throw new PostgrestMockError(`duplicate key value for todo ${todoId}`, 'P0001')
      }

      state.todos.push({
        id: todoId,
        label,
        week_number: typeof values.weekNumber === 'number' ? values.weekNumber : null,
        done: values.done,
        archived: values.archived,
        created_at: createdAt,
        updated_at: updatedAt,
        device_id: deviceId,
        user_id: userId,
        deleted_at: deletedAt ?? null,
      })
    } else if (intent.kind === 'update' || intent.kind === 'delete') {
      if (updatedAt == null) {
        throw new PostgrestMockError('update and delete intents require updatedAt')
      }

      const todo = findOwnTodo(todoId, userId)

      if (intent.kind === 'delete') {
        if (deletedAt == null) throw new PostgrestMockError('delete intent requires deletedAt')
        todo.deleted_at = deletedAt
      } else {
        if ('label' in values) todo.label = label
        if ('weekNumber' in values) {
          todo.week_number = typeof values.weekNumber === 'number' ? values.weekNumber : null
        }
        if ('done' in values) todo.done = values.done === true
        if ('archived' in values) todo.archived = values.archived === true
        if ('deletedAt' in values) todo.deleted_at = deletedAt ?? null
      }

      todo.updated_at = updatedAt
      todo.device_id = deviceId ?? todo.device_id
    } else {
      throw new PostgrestMockError(`apply_todo_mutation does not support kind ${intent.kind}`)
    }

    const accepted = accept(mutationId, todoId, userId)
    save()
    return accepted
  }

  /** Rows visible to `userId`, like the `todos_select_own` RLS policy. */
  function selectTodos(userId: string | null): ConfirmedTodoRow[] {
    return userId ? state.todos.filter((row) => row.user_id === userId) : []
  }

  function reset() {
    storage?.removeItem(STORAGE_KEY)
    state = load()
  }

  return { applyTodoMutation, reset, selectTodos }
}

export type MockDatabase = ReturnType<typeof createMockDatabase>
