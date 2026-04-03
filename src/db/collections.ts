import type { InferOutput } from 'valibot'
import { env } from '@/lib/env'
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

/**
 * Gets the device ID for tracking which device created/modified todos
 */
function getDeviceId(): string {
  return env.deviceId
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
