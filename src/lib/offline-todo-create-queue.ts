import * as v from 'valibot'

import { todoSchema, type Todo } from '@/db/collections'

const STORAGE_KEY = 'ai-todo-app-offline-created-todos'
const SIGNED_OUT_QUEUE_PARTITION = 'signed-out'

export type QueuedTodoCreateEntry = {
  partitionKey: string
  queuedAt: number
  todo: Todo
  updatedAt: number
}

type OfflineTodoCreateQueueOptions = {
  storage?: Storage | null
}

type StoredQueuedTodoCreateEntry = Omit<QueuedTodoCreateEntry, 'todo'> & {
  todo: unknown
}

function getBrowserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function parseQueuedTodoCreateEntry(input: StoredQueuedTodoCreateEntry): QueuedTodoCreateEntry {
  const todoResult = v.safeParse(todoSchema, input.todo)

  if (!todoResult.success) {
    throw new Error('Queued todo entry contains an invalid todo payload')
  }

  return {
    partitionKey: input.partitionKey,
    queuedAt: input.queuedAt,
    todo: todoResult.output,
    updatedAt: input.updatedAt,
  }
}

function parseStoredEntries(input: unknown): QueuedTodoCreateEntry[] {
  if (input === null || input === undefined || input === '') {
    return []
  }

  if (typeof input !== 'string') {
    throw new Error('Offline todo queue storage is invalid')
  }

  const parsed = JSON.parse(input) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Offline todo queue storage must contain an array')
  }

  return parsed.map((entry) => parseQueuedTodoCreateEntry(entry as StoredQueuedTodoCreateEntry))
}

function sortEntries(entries: QueuedTodoCreateEntry[]) {
  return entries.toSorted((left, right) => left.queuedAt - right.queuedAt)
}

function isSameQueuedTodo(
  left: Pick<QueuedTodoCreateEntry, 'partitionKey' | 'todo'>,
  right: Pick<QueuedTodoCreateEntry, 'partitionKey' | 'todo'>,
) {
  return left.partitionKey === right.partitionKey && left.todo.id === right.todo.id
}

export function getOfflineTodoCreatePartitionKey(userId: string | null) {
  return userId ? `user:${userId}` : SIGNED_OUT_QUEUE_PARTITION
}

export function createOfflineTodoCreateQueue(options: OfflineTodoCreateQueueOptions = {}) {
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage

  function readAll() {
    return sortEntries(parseStoredEntries(storage?.getItem(STORAGE_KEY) ?? null))
  }

  function writeAll(entries: QueuedTodoCreateEntry[]) {
    storage?.setItem(STORAGE_KEY, JSON.stringify(sortEntries(entries)))
  }

  return {
    list(partitionKey: string) {
      return readAll().filter((entry) => entry.partitionKey === partitionKey)
    },
    remove(partitionKey: string, todoId: string) {
      writeAll(
        readAll().filter(
          (entry) => !(entry.partitionKey === partitionKey && entry.todo.id === todoId),
        ),
      )
    },
    save(entry: QueuedTodoCreateEntry) {
      const nextEntries = readAll().filter((candidate) => !isSameQueuedTodo(candidate, entry))

      nextEntries.push({
        ...entry,
        todo: v.parse(todoSchema, entry.todo),
      })

      writeAll(nextEntries)
    },
  }
}
