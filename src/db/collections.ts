import type { InferOutput } from 'valibot'
import { env } from '@/lib/env'
import {
  boolean,
  maxLength,
  maxValue,
  minLength,
  minValue,
  nullable,
  number,
  object,
  optional,
  pipe,
  regex,
  safeInteger,
  string,
} from 'valibot'

export const todoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be at most 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)

const epochMillisecondsSchema = pipe(
  number(),
  safeInteger('Timestamp must be a safe integer'),
  minValue(0, 'Timestamp cannot be negative'),
  maxValue(253_402_300_799_999, 'Timestamp is out of range'),
)

export const todoSchema = object({
  id: pipe(string(), minLength(1)),
  label: todoLabelSchema,
  weekNumber: nullable(number()),
  done: boolean(),
  archived: boolean(),
  createdAt: epochMillisecondsSchema,
  updatedAt: epochMillisecondsSchema,
  deviceId: nullable(string()),
  userId: optional(nullable(string()), null),
  deletedAt: optional(nullable(epochMillisecondsSchema), null),
})

export type Todo = InferOutput<typeof todoSchema>

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
