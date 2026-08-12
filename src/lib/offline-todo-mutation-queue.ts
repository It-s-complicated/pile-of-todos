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

const nonEmptyStringSchema = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
)
const storedNumberSchema = v.pipe(
  v.number(),
  v.check((value) => !Number.isNaN(value)),
)
const nullableNumberSchema = v.nullable(storedNumberSchema)
const optionalNullableNumberSchema = v.optional(nullableNumberSchema, null)

const createMutationValuesSchema = v.object({
  archived: v.boolean(),
  createdAt: storedNumberSchema,
  deletedAt: nullableNumberSchema,
  done: v.boolean(),
  label: nonEmptyStringSchema,
  updatedAt: storedNumberSchema,
  weekNumber: optionalNullableNumberSchema,
})

const updateMutationValuesSchema = v.object({
  archived: v.optional(v.boolean()),
  createdAt: v.optional(storedNumberSchema),
  deletedAt: v.optional(nullableNumberSchema),
  done: v.optional(v.boolean()),
  label: v.optional(nonEmptyStringSchema),
  updatedAt: storedNumberSchema,
  weekNumber: v.optional(nullableNumberSchema),
})

const deleteMutationValuesSchema = v.object({
  deletedAt: storedNumberSchema,
  updatedAt: storedNumberSchema,
})

const queuedTodoMutationSchema = v.variant('kind', [
  v.object({
    kind: v.literal('create'),
    mutationId: nonEmptyStringSchema,
    optimisticTodo: todoSchema,
    todoId: nonEmptyStringSchema,
    values: createMutationValuesSchema,
  }),
  v.object({
    kind: v.literal('delete'),
    mutationId: nonEmptyStringSchema,
    optimisticTodo: todoSchema,
    todoId: nonEmptyStringSchema,
    updates: deleteMutationValuesSchema,
  }),
  v.object({
    kind: v.literal('update'),
    mutationId: nonEmptyStringSchema,
    optimisticTodo: todoSchema,
    todoId: nonEmptyStringSchema,
    updates: updateMutationValuesSchema,
  }),
])

const queuedTodoMutationEntrySchema = v.object({
  acceptedAt: optionalNullableNumberSchema,
  partitionKey: nonEmptyStringSchema,
  mutation: queuedTodoMutationSchema,
  queuedAt: storedNumberSchema,
  state: v.picklist(['accepted', 'queued']),
  updatedAt: storedNumberSchema,
})

const queuedTodoMutationEntriesSchema = v.array(queuedTodoMutationEntrySchema)

const legacyQueuedTodoCreateEntrySchema = v.object({
  partitionKey: nonEmptyStringSchema,
  queuedAt: storedNumberSchema,
  todo: v.unknown(),
  updatedAt: storedNumberSchema,
})

const legacyQueuedTodoCreateEntriesSchema = v.array(legacyQueuedTodoCreateEntrySchema)

function getBrowserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function parseSchema<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  input: unknown,
  message: string,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, input)

  if (!result.success) {
    throw new Error(message)
  }

  return result.output
}

function parseTodo(value: unknown, message: string): Todo {
  return parseSchema(todoSchema, value, message)
}

function parseStoredEntries(input: unknown): QueuedTodoMutationEntry[] {
  if (input === null || input === undefined || input === '') {
    return []
  }

  if (typeof input !== 'string') {
    throw new Error('Offline todo mutation queue storage is invalid')
  }

  const parsed = JSON.parse(input) as unknown

  return parseSchema(
    queuedTodoMutationEntriesSchema,
    parsed,
    'Offline todo mutation queue storage must contain valid entries',
  ) as QueuedTodoMutationEntry[]
}

function parseLegacyCreates(input: unknown): LegacyQueuedTodoCreateEntry[] {
  if (input === null || input === undefined || input === '') {
    return []
  }

  if (typeof input !== 'string') {
    throw new Error('Legacy offline todo create queue storage is invalid')
  }

  const parsed = JSON.parse(input) as unknown

  return parseSchema(
    legacyQueuedTodoCreateEntriesSchema,
    parsed,
    'Legacy offline todo create queue storage must contain valid entries',
  ) as LegacyQueuedTodoCreateEntry[]
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
