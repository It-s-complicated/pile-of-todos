import { supabaseCollectionOptions } from '@supabase-labs/tanstack-db'
import { createCollection } from '@tanstack/vue-db'
import * as v from 'valibot'

import { getSupabaseClient } from '@/lib/supabase'

import { todoSchema, type Todo } from './collections'

export const confirmedTodoRowSchema = v.object({
  id: v.string(),
  label: v.string(),
  week_number: v.nullable(v.number()),
  done: v.boolean(),
  archived: v.boolean(),
  created_at: v.number(),
  updated_at: v.number(),
  device_id: v.nullable(v.string()),
  user_id: v.string(),
  deleted_at: v.nullable(v.number()),
})

export type ConfirmedTodoRow = v.InferOutput<typeof confirmedTodoRowSchema>

export function mapConfirmedTodoRow(row: ConfirmedTodoRow): Todo {
  return v.parse(todoSchema, {
    id: row.id,
    label: row.label,
    weekNumber: row.week_number,
    done: row.done,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deviceId: row.device_id,
    userId: row.user_id,
    deletedAt: row.deleted_at,
  })
}

const confirmedTodosCollection = createCollection(
  supabaseCollectionOptions({
    tableName: 'todos',
    keys: ['id'],
    schema: confirmedTodoRowSchema,
    supabase: getSupabaseClient(),
    realtime: true,
  }),
)

export function getConfirmedTodosCollection() {
  return confirmedTodosCollection
}

export async function refreshConfirmedTodos(): Promise<void> {
  const observerResults = await confirmedTodosCollection.utils.refetch({ throwOnError: true })

  if (observerResults.length === 0) {
    throw new Error('Confirmed todo snapshot is not active')
  }
}
