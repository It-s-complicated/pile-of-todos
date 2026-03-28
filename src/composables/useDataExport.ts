import type { InferOutput } from 'valibot'
import { array, object, safeParse, string } from 'valibot'
import { assignImportedTodos } from '@/lib/todo-storage'
import { getActiveCollection, todoSchema } from '../db/collections'
import { useAuth } from './useAuth'

const ExportDataSchema = object({
  version: string(),
  exportedAt: string(),
  todos: array(todoSchema),
})

type ExportData = InferOutput<typeof ExportDataSchema>

export function useDataExport() {
  const { accessState, userId } = useAuth()

  function getActiveUserId() {
    return accessState.value === 'approved' ? userId.value : null
  }

  function exportTodos(): void {
    const activeCollection = getActiveCollection(getActiveUserId())
    const allTodos = activeCollection.toArray
    const exportData: ExportData = {
      version: '3',
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
  ): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate with valibot
      const result = safeParse(ExportDataSchema, data)

      if (!result.success) {
        const issue = result.issues[0]
        const path = issue.path?.map((p) => (typeof p === 'string' ? p : p.key)).join('.') || 'root'
        return { success: false, message: `Validation error at ${path}: ${issue.message}` }
      }

      const activeCollection = getActiveCollection(getActiveUserId())
      const validatedTodos = assignImportedTodos(result.output.todos, getActiveUserId(), Date.now())

      // Clear existing data and bulk insert
      const existingIds = Array.from(activeCollection.keys())
      if (existingIds.length > 0) {
        activeCollection.delete(existingIds)
      }

      if (validatedTodos.length > 0) {
        activeCollection.insert(validatedTodos)
      }

      return {
        success: true,
        message: `Successfully imported ${validatedTodos.length} todos`,
        count: validatedTodos.length,
      }
    } catch (error) {
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
