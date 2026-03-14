import type { Todo } from '../db/collections'
import { getActiveCollection, getCurrentDeviceId } from '../db/collections'
import { useAuth } from './useAuth'

export function useTodos() {
  const { accessState, userId } = useAuth()

  function getCollection() {
    return getActiveCollection(accessState.value === 'approved' ? userId.value : null)
  }

  function getAllTodos(): Todo[] {
    return getCollection().toArray
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
      userId: accessState.value === 'approved' ? userId.value : null,
      deletedAt: null,
    }
    getCollection().insert(todo)
    return id
  }

  function updateTodo(id: string, updates: Partial<Todo>): void {
    getCollection().update(id, (draft) => {
      Object.assign(draft, updates, {
        updatedAt: Date.now(),
        deviceId: draft.deviceId ?? null,
      })
    })
  }

  function deleteTodo(id: string): void {
    getCollection().update(id, (draft) => {
      draft.deletedAt = Date.now()
      draft.updatedAt = Date.now()
      draft.deviceId = getCurrentDeviceId()
    })
  }

  function archiveTodo(id: string): void {
    getCollection().update(id, (draft) => {
      draft.archived = true
      draft.updatedAt = Date.now()
      draft.deviceId = draft.deviceId ?? null
    })
  }

  function toggleTodoDone(id: string): void {
    const collection = getCollection()
    const todo = collection.get(id)
    if (todo) {
      collection.update(id, (draft) => {
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
