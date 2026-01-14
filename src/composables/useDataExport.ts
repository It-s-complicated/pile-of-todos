import { db } from '../db/db'

export function useDataExport() {
  async function exportTodos(): Promise<void> {
    const todos = await db.todos.toArray()
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      todos,
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

  async function importTodos(file: File): Promise<{ success: boolean, message: string, count?: number }> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.todos || !Array.isArray(data.todos)) {
        return { success: false, message: 'Invalid file format: missing or invalid todos array' }
      }

      for (const todo of data.todos) {
        if (!todo.id || !todo.label || typeof todo.done !== 'boolean' || typeof todo.archived !== 'boolean') {
          return { success: false, message: 'Invalid todo format in file' }
        }
      }

      await db.transaction('rw', db.todos, async () => {
        for (const todo of data.todos) {
          const existingTodo = await db.todos.get(todo.id)
          if (existingTodo) {
            await db.todos.update(todo.id, todo)
          }
          else {
            await db.todos.add(todo)
          }
        }
      })

      return { success: true, message: `Successfully imported ${data.todos.length} todos`, count: data.todos.length }
    }
    catch (error) {
      if (error instanceof SyntaxError) {
        return { success: false, message: 'Invalid JSON file' }
      }
      return { success: false, message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }

  return { exportTodos, importTodos }
}
