import type { InferOutput } from 'valibot'
import { createCollection, localStorageCollectionOptions } from '@tanstack/vue-db'
import { env } from '@/lib/env'
import { getActiveStorageKey } from '@/lib/todo-storage'
import {
  boolean,
  maxLength,
  minLength,
  nullable,
  number,
  object,
  optional,
  pipe,
  regex,
  string,
} from 'valibot'

export const todoSchema = object({
  id: pipe(string(), minLength(1)),
  label: pipe(
    string(),
    minLength(1, 'Label cannot be empty'),
    maxLength(500, 'Label must be less than 500 characters'),
    regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
  ),
  weekNumber: nullable(number()),
  done: boolean(),
  archived: boolean(),
  createdAt: number(),
  updatedAt: number(),
  deviceId: nullable(string()),
  userId: optional(nullable(string()), null),
  deletedAt: optional(nullable(number()), null),
})

export type Todo = InferOutput<typeof todoSchema>

export type TodoFilter =
  | 'backlog'
  | 'current-week'
  | 'future'
  | 'unfinished'
  | 'archived'
  | 'finished'

export const VALID_FILTERS: TodoFilter[] = [
  'backlog',
  'current-week',
  'future',
  'unfinished',
  'archived',
  'finished',
]

function createLocalTodosCollection(storageKey: string) {
  return createCollection(
    localStorageCollectionOptions({
      id: `local-todos-${storageKey.replace(/[^a-z0-9:]+/gi, '-')}`,
      storageKey,
      getKey: (item) => item.id,
      schema: todoSchema,
    }),
  )
}

const localCollectionCache = new Map<string, ReturnType<typeof createLocalTodosCollection>>()

export function getLocalTodosCollection(userId: string | null) {
  const storageKey = getActiveStorageKey(userId)
  const existingCollection = localCollectionCache.get(storageKey)

  if (existingCollection) {
    return existingCollection
  }

  const collection = createLocalTodosCollection(storageKey)
  localCollectionCache.set(storageKey, collection)
  return collection
}

export const localTodosCollection = getLocalTodosCollection(null)

// Keep original export for backward compatibility during migration
export const todosCollection = localTodosCollection

/**
 * Gets the device ID for tracking which device created/modified todos
 */
function getDeviceId(): string {
  return env.deviceId
}

// Always read/write from local storage so todos remain available offline.
// Cloud sync runs separately and reconciles with the active local bucket.
export function getActiveCollection(userId: string | null = null) {
  return getLocalTodosCollection(userId)
}

export function getGuestCollection() {
  return localTodosCollection
}

// Helper to get device ID for tracking
export function getCurrentDeviceId(): string {
  return getDeviceId()
}

export const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)
