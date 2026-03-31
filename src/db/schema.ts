import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTable,
  timestamp,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { createSelectSchema, createInsertSchema } from 'drizzle-valibot'
import * as v from 'valibot'

const xid8 = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'xid8'
  },
})

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

export const todoMutationLedgerTable = pgTable(
  'todo_mutation_ledger',
  {
    mutationId: text('mutation_id').primaryKey(),
    userId: uuid('user_id').notNull(),
    todoId: uuid('todo_id').notNull(),
    txid: xid8('txid').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_todo_mutation_ledger_user_id').on(table.userId)],
)

// Generate valibot schemas from Drizzle schema for type safety
export const selectTodoSchema = createSelectSchema(todosTable)
export const insertTodoSchema = createInsertSchema(todosTable)

// Export types
export type Todo = v.InferOutput<typeof selectTodoSchema>
export type NewTodo = v.InferOutput<typeof insertTodoSchema>
