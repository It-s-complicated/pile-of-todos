import { bigint, boolean, index, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createSelectSchema, createInsertSchema } from 'drizzle-valibot'
import * as v from 'valibot'

// Define the todos table matching the existing TodoSchema
export const todosTable = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: varchar('label', { length: 500 }).notNull(),
    weekNumber: integer('week_number'),
    done: boolean('done').default(false).notNull(),
    archived: boolean('archived').default(false).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    deviceId: varchar('device_id', { length: 255 }),
    userId: uuid('user_id'),
    deletedAt: bigint('deleted_at', { mode: 'number' }),
  },
  (table) => [index('idx_todos_user_id').on(table.userId)],
)

// Generate valibot schemas from Drizzle schema for type safety
export const selectTodoSchema = createSelectSchema(todosTable)
export const insertTodoSchema = createInsertSchema(todosTable)

// Export types
export type Todo = v.InferOutput<typeof selectTodoSchema>
export type NewTodo = v.InferOutput<typeof insertTodoSchema>
