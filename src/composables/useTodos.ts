import type { Todo } from '../db/collections'
import { getCurrentDeviceId, todosCollection } from '../db/collections'

export function useTodos() {
  function getAllTodos(): Todo[] {
    return todosCollection.toArray
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
      deviceId: getCurrentDeviceId(),
    }
    todosCollection.insert(todo)
    return id
  }

  function updateTodo(id: string, updates: Partial<Todo>): void {
    todosCollection.update(id, (draft) => {
      Object.assign(draft, updates, {
        updatedAt: Date.now(),
        deviceId: draft.deviceId ?? null,
      })
    })
  }

  function deleteTodo(id: string): void {
    todosCollection.delete(id)
  }

  function archiveTodo(id: string): void {
    todosCollection.update(id, (draft) => {
      draft.archived = true
      draft.updatedAt = Date.now()
      draft.deviceId = draft.deviceId ?? null
    })
  }

  function toggleTodoDone(id: string): void {
    const todo = todosCollection.get(id)
    if (todo) {
      todosCollection.update(id, (draft) => {
        draft.done = !todo.done
        draft.updatedAt = Date.now()
        draft.deviceId = draft.deviceId ?? null
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
