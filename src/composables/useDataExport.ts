import { useTodoData } from '@/composables/useTodoData'
import { stageImportedTodosAsMigrationInput } from '@/lib/todo-storage'

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

export function useDataExport() {
  const todoData = useTodoData()

  function formatImportedTodoMessage(addedCount: number) {
    const todoLabel = addedCount === 1 ? 'todo' : 'todos'
    return `Imported ${addedCount} ${todoLabel} into migration staging.`
  }

  function exportTodos(): string {
    const visibleTodos = todoData.readModel.todos.value.filter((todo) => todo.deletedAt === null)

    return JSON.stringify({ todos: visibleTodos }, null, 2)
  }

  async function importTodos(file: File): Promise<{ success: boolean; message: string }> {
    try {
      const importedPayload = JSON.parse(await file.text()) as unknown
      const importedTodos = parseImportedTodosPayload(importedPayload)
      const { addedCount } = stageImportedTodosAsMigrationInput({ todos: importedTodos })

      return {
        success: true,
        message: formatImportedTodoMessage(addedCount),
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
