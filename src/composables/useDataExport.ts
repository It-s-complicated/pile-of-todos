import type { InferOutput } from 'valibot'
import { array, object, safeParse, string } from 'valibot'
import { TodoSchema, todosCollection } from '../db/collections'

const ExportDataSchema = object({
  version: string(),
  exportedAt: string(),
  todos: array(TodoSchema),
})

type ExportData = InferOutput<typeof ExportDataSchema>

export function useDataExport() {
  function exportTodos(): void {
    const allTodos = todosCollection.utils.getAll()
    const exportData: ExportData = {
      version: '2',
      exportedAt: new Date().toISOString(),
      todos: allTodos,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `todo-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function importTodos(
    file: File,
  ): Promise<{ success: boolean, message: string, count?: number }> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate with valibot
      const result = safeParse(ExportDataSchema, data)

      if (!result.success) {
        const issue = result.issues[0]
        const path = issue.path?.map(p => (typeof p === 'string' ? p : p.key)).join('.') || 'root'
        return { success: false, message: `Validation error at ${path}: ${issue.message}` }
      }

      const validatedTodos = result.output.todos

      // Clear existing data and bulk insert
      todosCollection.utils.clear()
      todosCollection.utils.bulkInsert(validatedTodos)

      return {
        success: true,
        message: `Successfully imported ${validatedTodos.length} todos`,
        count: validatedTodos.length,
      }
    }
    catch (error) {
      if (error instanceof SyntaxError) {
        return { success: false, message: 'Invalid JSON file' }
      }
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  return { exportTodos, importTodos }
}
