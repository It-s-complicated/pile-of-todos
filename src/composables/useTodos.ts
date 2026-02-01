import type { Todo } from '../db/collections'
import { todosCollection } from '../db/collections'

export function useTodos() {
  function getAllTodos(): Todo[] {
    return todosCollection.utils.getAll()
  }

  function addTodo(label: string, weekNumber: number | null): string {
    const id = crypto.randomUUID()
    const now = Date.now()
    const todo: Todo = {
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    todosCollection.insert(todo)
    return id
  }

  function updateTodo(id: string, updates: Partial<Todo>): void {
    todosCollection.update(id, (draft) => {
      Object.assign(draft, updates, { updatedAt: Date.now() })
    })
  }

  function deleteTodo(id: string): void {
    todosCollection.delete(id)
  }

  function archiveTodo(id: string): void {
    todosCollection.update(id, (draft) => {
      draft.archived = true
      draft.updatedAt = Date.now()
    })
  }

  function toggleTodoDone(id: string): void {
    const todo = todosCollection.utils.get(id)
    if (todo) {
      todosCollection.update(id, (draft) => {
        draft.done = !todo.done
        draft.updatedAt = Date.now()
      })
    }
  }

  return {
    getAllTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    archiveTodo,
    toggleTodoDone,
  }
}
