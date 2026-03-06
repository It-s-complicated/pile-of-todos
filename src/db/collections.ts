import type { InferOutput } from 'valibot'
import { createCollection, localStorageCollectionOptions } from '@tanstack/vue-db'
import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { snakeCamelMapper } from '@electric-sql/client'
import { isSupabaseConfigured } from '@/lib/supabase'
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

// LocalStorage collection for offline-first support
export const localTodosCollection = createCollection(
  localStorageCollectionOptions({
    id: 'local-todos',
    storageKey: 'ai-todo-app-todos',
    getKey: (item) => item.id,
    schema: todoSchema,
  }),
)

// Keep original export for backward compatibility during migration
export const todosCollection = localTodosCollection

/**
 * Gets the Electric SQL endpoint URL based on environment configuration
 */
function getElectricShapeUrl(): string {
  if (import.meta.env.VITE_ELECTRIC_SHAPE_URL) {
    return import.meta.env.VITE_ELECTRIC_SHAPE_URL
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:30000'
  return `${apiBaseUrl.replace(/\/+$/, '')}/v1/shape`
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
function prepareElectricShapeUrl(): URL {
  const shapeUrl = new URL(getElectricShapeUrl())

  // Add Electric Cloud authentication if configured
  const sourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID
  const secret = import.meta.env.VITE_ELECTRIC_SECRET

  if (sourceId && secret) {
    shapeUrl.searchParams.set('source_id', sourceId)
    shapeUrl.searchParams.set('secret', secret)
  }

  return shapeUrl
}

export const electricTodosCollection = createCollection(
  electricCollectionOptions({
    id: 'electric-todos',
    schema: todoSchema,
    getKey: (item) => item.id,
    shapeOptions: {
      url: prepareElectricShapeUrl().toString(),
      columnMapper: snakeCamelMapper(),
      parser: {
        int8: (value) => Number(value),
      },
      params: {
        table: 'todos',
      },
    },
  }),
)

// Helper to check if Electric sync is configured
export function isElectricConfigured(): boolean {
  const hasElectricReadConfig = !!import.meta.env.VITE_ELECTRIC_SHAPE_URL || !!import.meta.env.VITE_API_BASE_URL
  return hasElectricReadConfig && isSupabaseConfigured()
}

// Helper to get the active collection based on configuration
export function getActiveCollection(isOnline = navigator.onLine) {
  void isOnline
  // Always read/write from local storage so todos remain available offline.
  // Cloud sync runs separately and reconciles with this local collection.
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
