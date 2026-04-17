import * as v from 'valibot'

import { todoSchema, type Todo } from '@/db/collections'
import type { TodoMutationValues } from '@/lib/todo-sync'

const STORAGE_KEY = 'ai-todo-app-offline-todo-mutations'
const LEGACY_CREATE_STORAGE_KEY = 'ai-todo-app-offline-created-todos'
const SIGNED_OUT_QUEUE_PARTITION = 'signed-out'

export type TodoMutationQueueState = 'accepted' | 'queued'

type TodoCreateMutation = {
  kind: 'create'
  mutationId: string
  optimisticTodo: Todo
  todoId: string
  values: {
    archived: boolean
    createdAt: number
    deletedAt: number | null
    done: boolean
    label: string
    updatedAt: number
    weekNumber: number | null
  }
}

type TodoUpdateMutation = {
  kind: 'update'
  mutationId: string
  optimisticTodo: Todo
  todoId: string
  updates: TodoMutationValues
}

type TodoDeleteMutation = {
  kind: 'delete'
  mutationId: string
  optimisticTodo: Todo
  todoId: string
  updates: {
    deletedAt: number
    updatedAt: number
  }
}

export type QueuedTodoMutation = TodoCreateMutation | TodoDeleteMutation | TodoUpdateMutation

export type QueuedTodoMutationEntry = {
  acceptedAt: number | null
  partitionKey: string
  mutation: QueuedTodoMutation
  queuedAt: number
  state: TodoMutationQueueState
  txid: number | null
  updatedAt: number
}

type LegacyQueuedTodoCreateEntry = {
  partitionKey: string
  queuedAt: number
  todo: unknown
  updatedAt: number
}

type OfflineTodoMutationQueueOptions = {
  storage?: Storage | null
}

function getBrowserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function assertObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message)
  }

  return value as Record<string, unknown>
}

function assertString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message)
  }

  return value
}

function assertNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(message)
  }

  return value
}

function assertNullableNumber(value: unknown, message: string): number | null {
  if (value === null) {
    return null
  }

  return assertNumber(value, message)
}

function assertBoolean(value: unknown, message: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(message)
  }

  return value
}

function parseTodo(value: unknown, message: string): Todo {
  const result = v.safeParse(todoSchema, value)

  if (!result.success) {
    throw new Error(message)
  }

  return result.output
}

function parseCreateValues(input: unknown): TodoCreateMutation['values'] {
  const value = assertObject(input, 'Queued create mutation values are invalid')

  return {
    archived: assertBoolean(value.archived, 'Queued create mutation archived flag is invalid'),
    createdAt: assertNumber(value.createdAt, 'Queued create mutation createdAt is invalid'),
    deletedAt: assertNullableNumber(value.deletedAt, 'Queued create mutation deletedAt is invalid'),
    done: assertBoolean(value.done, 'Queued create mutation done flag is invalid'),
    label: assertString(value.label, 'Queued create mutation label is invalid'),
    updatedAt: assertNumber(value.updatedAt, 'Queued create mutation updatedAt is invalid'),
    weekNumber:
      value.weekNumber === undefined
        ? null
        : assertNullableNumber(value.weekNumber, 'Queued create mutation weekNumber is invalid'),
  }
}

function parseUpdateValues(input: unknown, messagePrefix: string): TodoMutationValues {
  const value = assertObject(input, `${messagePrefix} values are invalid`)
  const updates: TodoMutationValues = {
    updatedAt: assertNumber(value.updatedAt, `${messagePrefix} updatedAt is invalid`),
  }

  if (Object.prototype.hasOwnProperty.call(value, 'archived')) {
    updates.archived = assertBoolean(value.archived, `${messagePrefix} archived flag is invalid`)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'createdAt')) {
    updates.createdAt = assertNumber(value.createdAt, `${messagePrefix} createdAt is invalid`)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'deletedAt')) {
    updates.deletedAt = assertNullableNumber(
      value.deletedAt,
      `${messagePrefix} deletedAt is invalid`,
    )
  }

  if (Object.prototype.hasOwnProperty.call(value, 'done')) {
    updates.done = assertBoolean(value.done, `${messagePrefix} done flag is invalid`)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'label')) {
    updates.label = assertString(value.label, `${messagePrefix} label is invalid`)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'weekNumber')) {
    updates.weekNumber = assertNullableNumber(
      value.weekNumber,
      `${messagePrefix} weekNumber is invalid`,
    )
  }

  return updates
}

function parseQueuedTodoMutation(input: unknown): QueuedTodoMutation {
  const value = assertObject(input, 'Queued todo mutation is invalid')
  const base = {
    mutationId: assertString(value.mutationId, 'Queued todo mutation is missing mutationId'),
    optimisticTodo: parseTodo(
      value.optimisticTodo,
      'Queued todo mutation optimistic todo is invalid',
    ),
    todoId: assertString(value.todoId, 'Queued todo mutation is missing todoId'),
  }
  const kind = assertString(value.kind, 'Queued todo mutation kind is invalid')

  if (kind === 'create') {
    return {
      ...base,
      kind,
      values: parseCreateValues(value.values),
    }
  }

  if (kind === 'delete') {
    const updates = parseUpdateValues(value.updates, 'Queued delete mutation')

    if (typeof updates.deletedAt !== 'number') {
      throw new Error('Queued delete mutation deletedAt is invalid')
    }

    return {
      ...base,
      kind,
      updates: {
        deletedAt: updates.deletedAt,
        updatedAt: updates.updatedAt,
      },
    }
  }

  if (kind === 'update') {
    return {
      ...base,
      kind,
      updates: parseUpdateValues(value.updates, 'Queued update mutation'),
    }
  }

  throw new Error('Queued todo mutation kind is invalid')
}

function parseQueuedTodoMutationEntry(input: unknown): QueuedTodoMutationEntry {
  const value = assertObject(input, 'Queued todo mutation entry is invalid')
  const stateValue = assertString(value.state, 'Queued todo mutation state is invalid')

  if (stateValue !== 'accepted' && stateValue !== 'queued') {
    throw new Error('Queued todo mutation state is invalid')
  }

  return {
    acceptedAt:
      value.acceptedAt === undefined || value.acceptedAt === null
        ? null
        : assertNumber(value.acceptedAt, 'Queued todo mutation acceptedAt is invalid'),
    partitionKey: assertString(value.partitionKey, 'Queued todo mutation partition is invalid'),
    mutation: parseQueuedTodoMutation(value.mutation),
    queuedAt: assertNumber(value.queuedAt, 'Queued todo mutation queuedAt is invalid'),
    state: stateValue,
    txid:
      value.txid === undefined || value.txid === null
        ? null
        : assertNumber(value.txid, 'Queued todo mutation txid is invalid'),
    updatedAt: assertNumber(value.updatedAt, 'Queued todo mutation updatedAt is invalid'),
  }
}

function parseStoredEntries(input: unknown): QueuedTodoMutationEntry[] {
  if (input === null || input === undefined || input === '') {
    return []
  }

  if (typeof input !== 'string') {
    throw new Error('Offline todo mutation queue storage is invalid')
  }

  const parsed = JSON.parse(input) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Offline todo mutation queue storage must contain an array')
  }

  return parsed.map((entry) => parseQueuedTodoMutationEntry(entry))
}

function parseLegacyCreates(input: unknown): LegacyQueuedTodoCreateEntry[] {
  if (input === null || input === undefined || input === '') {
    return []
  }

  if (typeof input !== 'string') {
    throw new Error('Legacy offline todo create queue storage is invalid')
  }

  const parsed = JSON.parse(input) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Legacy offline todo create queue storage must contain an array')
  }

  return parsed.map((entry) => {
    const value = assertObject(entry, 'Legacy queued todo entry is invalid')

    return {
      partitionKey: assertString(value.partitionKey, 'Legacy queued todo partition is invalid'),
      queuedAt: assertNumber(value.queuedAt, 'Legacy queued todo queuedAt is invalid'),
      todo: value.todo,
      updatedAt: assertNumber(value.updatedAt, 'Legacy queued todo updatedAt is invalid'),
    }
  })
}

function sortEntries(entries: QueuedTodoMutationEntry[]) {
  return entries.toSorted((left, right) => {
    if (left.queuedAt !== right.queuedAt) {
      return left.queuedAt - right.queuedAt
    }

    return left.updatedAt - right.updatedAt
  })
}

function normalizeEntry(entry: QueuedTodoMutationEntry): QueuedTodoMutationEntry {
  return JSON.parse(JSON.stringify(entry)) as QueuedTodoMutationEntry
}

function isSameEntry(
  left: Pick<QueuedTodoMutationEntry, 'partitionKey' | 'mutation'>,
  right: Pick<QueuedTodoMutationEntry, 'partitionKey' | 'mutation'>,
) {
  return (
    left.partitionKey === right.partitionKey &&
    left.mutation.mutationId === right.mutation.mutationId
  )
}

function migrateLegacyCreates(storage: Storage | null, currentEntries: QueuedTodoMutationEntry[]) {
  const legacyEntries = parseLegacyCreates(storage?.getItem(LEGACY_CREATE_STORAGE_KEY) ?? null)

  if (legacyEntries.length === 0) {
    return currentEntries
  }

  const migratedEntries = legacyEntries.map((entry) => {
    const todo = parseTodo(entry.todo, 'Legacy queued todo payload is invalid')

    return normalizeEntry({
      acceptedAt: null,
      partitionKey: entry.partitionKey,
      mutation: {
        kind: 'create',
        mutationId: `legacy-create:${entry.partitionKey}:${todo.id}`,
        optimisticTodo: todo,
        todoId: todo.id,
        values: {
          archived: todo.archived,
          createdAt: todo.createdAt,
          deletedAt: todo.deletedAt,
          done: todo.done,
          label: todo.label,
          updatedAt: todo.updatedAt,
          weekNumber: todo.weekNumber,
        },
      },
      queuedAt: entry.queuedAt,
      state: 'queued',
      txid: null,
      updatedAt: entry.updatedAt,
    })
  })

  const mergedEntries = sortEntries([
    ...currentEntries,
    ...migratedEntries.filter(
      (candidate) => !currentEntries.some((entry) => isSameEntry(entry, candidate)),
    ),
  ])

  storage?.setItem(STORAGE_KEY, JSON.stringify(mergedEntries))
  storage?.removeItem(LEGACY_CREATE_STORAGE_KEY)

  return mergedEntries
}

export function getOfflineTodoMutationPartitionKey(userId: string | null) {
  return userId ? `user:${userId}` : SIGNED_OUT_QUEUE_PARTITION
}

export function createOfflineTodoMutationQueue(options: OfflineTodoMutationQueueOptions = {}) {
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage

  function readAll() {
    return migrateLegacyCreates(
      storage,
      sortEntries(parseStoredEntries(storage?.getItem(STORAGE_KEY) ?? null)),
    )
  }

  function writeAll(entries: QueuedTodoMutationEntry[]) {
    storage?.setItem(STORAGE_KEY, JSON.stringify(sortEntries(entries).map(normalizeEntry)))
  }

  return {
    clear(partitionKey: string) {
      writeAll(readAll().filter((entry) => entry.partitionKey !== partitionKey))
    },
    list(partitionKey: string) {
      return readAll().filter((entry) => entry.partitionKey === partitionKey)
    },
    remove(partitionKey: string, mutationId: string) {
      writeAll(
        readAll().filter(
          (entry) =>
            !(entry.partitionKey === partitionKey && entry.mutation.mutationId === mutationId),
        ),
      )
    },
    save(entry: QueuedTodoMutationEntry) {
      const nextEntries = readAll().filter((candidate) => !isSameEntry(candidate, entry))

      nextEntries.push(normalizeEntry(entry))
      writeAll(nextEntries)
    },
  }
}
