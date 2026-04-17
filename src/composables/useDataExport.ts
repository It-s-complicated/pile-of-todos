import * as v from 'valibot'

import { todoSchema, type Todo } from '@/db/collections'
import { useTodoData } from '@/composables/useTodoData'
import { useTodoMutations } from '@/composables/useTodoMutations'
import { useAuth } from '@/composables/useAuth'

function parseImportedTodosPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (typeof payload === 'object' && payload !== null && 'todos' in payload) {
    const todos = (payload as { todos?: unknown }).todos

    if (Array.isArray(todos)) {
      return todos
    }
  }

  throw new Error('Import file must contain a todo array or an object with a todos array')
}

function formatImportedTodoMessage(count: number) {
  const todoLabel = count === 1 ? 'todo' : 'todos'
  return `Imported ${count} ${todoLabel}`
}

function extractValidationError(issues: readonly v.BaseIssue<unknown>[]): string {
  const firstIssue = issues[0]

  if (!firstIssue) {
    return `Invalid todo: issue missing`
  }

  const path = firstIssue.path
  const fieldName = path?.[0] && 'key' in path[0] ? (String(path[0].key) as string) : 'unknown'
  const message = firstIssue.message || 'validation failed'

  return `Invalid todo: ${fieldName} ${message}`
}

export function useDataExport() {
  const { isAuthenticated } = useAuth()
  const todoData = useTodoData()
  const { createTodo } = useTodoMutations()

  function exportTodos(): string {
    const visibleTodos = todoData.readModel.todos.value.filter((todo) => todo.deletedAt === null)

    return JSON.stringify({ todos: visibleTodos }, null, 2)
  }

  async function importTodos(file: File): Promise<{ success: boolean; message: string }> {
    if (!isAuthenticated.value) {
      return { success: false, message: 'Please sign in to import todos' }
    }

    try {
      const importedPayload = JSON.parse(await file.text()) as unknown
      const rawTodos = parseImportedTodosPayload(importedPayload)

      const existingIds = new Set(todoData.readModel.todos.value.map((todo) => todo.id))
      const importedIds = new Set<string>()

      for (const rawTodo of rawTodos) {
        const result = v.safeParse(todoSchema, rawTodo)

        if (!result.success && result.issues) {
          return {
            success: false,
            message: extractValidationError(result.issues),
          }
        }

        const todo = result.output as Todo

        if (importedIds.has(todo.id)) {
          return {
            success: false,
            message: `Duplicate ID: ${todo.id}`,
          }
        }

        if (existingIds.has(todo.id)) {
          return {
            success: false,
            message: `Duplicate ID: ${todo.id}`,
          }
        }

        importedIds.add(todo.id)
      }

      let importedCount = 0

      for (const rawTodo of rawTodos) {
        const todo = v.parse(todoSchema, rawTodo) as Todo
        await createTodo(todo.label, todo.weekNumber, todo.id)
        importedCount++
      }

      return {
        success: true,
        message: formatImportedTodoMessage(importedCount),
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to import todos.',
      }
    }
  }

  return { exportTodos, importTodos }
}
