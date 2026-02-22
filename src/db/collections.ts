import type { InferOutput } from 'valibot'
import { createCollection, localStorageCollectionOptions } from '@tanstack/vue-db'
import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import {
  boolean,
  maxLength,
  minLength,
  nullable,
  number,
  object,
  pipe,
  regex,
  string,
} from 'valibot'

export const TodoSchema = object({
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
})

export type Todo = InferOutput<typeof TodoSchema>

export type TodoFilter
  = | 'backlog'
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

// LocalStorage collection for offline-first support
export const localTodosCollection = createCollection(
  localStorageCollectionOptions({
    id: 'local-todos',
    storageKey: 'ai-todo-app-todos',
    getKey: item => item.id,
    schema: TodoSchema,
  }),
)

// Keep original export for backward compatibility during migration
export const todosCollection = localTodosCollection

/**
 * Gets the Electric SQL endpoint URL based on environment configuration
 */
function getElectricUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:30000'
}

/**
 * Gets the device ID for tracking which device created/modified todos
 */
function getDeviceId(): string {
  return import.meta.env.VITE_DEVICE_ID || `device-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Prepares the Electric SQL shape URL with authentication
 * Adds source_id and secret for Electric Cloud authentication
 */
function prepareElectricShapeUrl(): string {
  const electricUrl = getElectricUrl()
  const shapeUrl = new URL(`${electricUrl}/v1/shape`)
  
  // Add Electric Cloud authentication if configured
  const sourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID
  const secret = import.meta.env.VITE_ELECTRIC_SECRET
  
  if (sourceId && secret) {
    shapeUrl.searchParams.set('source_id', sourceId)
    shapeUrl.searchParams.set('secret', secret)
  }
  
  return shapeUrl.toString()
}

/**
 * Prepares an API URL for write operations (POST/PUT/DELETE)
 * Mirrors the query param handling from the proxy
 */
function prepareApiUrl(path: string = ''): string {
  const electricUrl = getElectricUrl()
  const apiUrl = new URL(`${electricUrl}${path}`)
  
  // Add Electric Cloud authentication if configured
  const sourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID
  const secret = import.meta.env.VITE_ELECTRIC_SECRET
  
  if (sourceId && secret) {
    apiUrl.searchParams.set('source_id', sourceId)
    apiUrl.searchParams.set('secret', secret)
  }
  
  return apiUrl.toString()
}

export const electricTodosCollection = createCollection(
  electricCollectionOptions({
    id: 'electric-todos',
    schema: TodoSchema,
    getKey: item => item.id,
    shapeOptions: {
      url: prepareElectricShapeUrl(),
      params: {
        table: 'todos',
      },
    },
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]
      const response = await fetch(prepareApiUrl('/todos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTodo),
      })

      if (!response.ok) {
        throw new Error(`Failed to insert todo: ${response.statusText}`)
      }

      const { txid } = await response.json()
      return { txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedTodo } = transaction.mutations[0]
      const response = await fetch(prepareApiUrl(`/todos/${updatedTodo.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTodo),
      })

      if (!response.ok) {
        throw new Error(`Failed to update todo: ${response.statusText}`)
      }

      const { txid } = await response.json()
      return { txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTodo } = transaction.mutations[0]
      const response = await fetch(prepareApiUrl(`/todos/${deletedTodo.id}`), {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to delete todo: ${response.statusText}`)
      }

      const { txid } = await response.json()
      return { txid }
    },
  }),
)

// Helper to check if Electric sync is configured
export function isElectricConfigured(): boolean {
  return !!import.meta.env.VITE_API_BASE_URL
}

// Helper to get the active collection based on configuration
export function getActiveCollection() {
  return isElectricConfigured() ? electricTodosCollection : localTodosCollection
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
