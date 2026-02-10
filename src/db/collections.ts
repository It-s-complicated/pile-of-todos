import type { InferOutput } from 'valibot'
import { createCollection, localStorageCollectionOptions } from '@tanstack/vue-db'
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

export const todosCollection = createCollection(
  localStorageCollectionOptions({
    id: 'todos',
    storageKey: 'ai-todo-app-todos',
    getKey: item => item.id,
    schema: TodoSchema,
  }),
)

export const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)
