import type { Todo, TodoFilter } from '../db/collections'
import { defineStore } from 'pinia'
import { todosCollection } from '../db/collections'

const VALID_FILTERS: TodoFilter[] = ['backlog', 'current-week', 'future', 'unfinished', 'archived', 'finished']

export const useTodosStore = defineStore('todos', () => {
  function addTodo(label: string, weekNumber: number | null) {
    const id = crypto.randomUUID()
    const now = Date.now()
    todosCollection.insert({
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  function updateTodo(id: string, updates: Partial<Todo>) {
    todosCollection.update(id, (draft) => {
      Object.assign(draft, updates, { updatedAt: Date.now() })
    })
  }

  function deleteTodo(id: string) {
    todosCollection.delete(id)
  }

  function archiveTodo(id: string) {
    todosCollection.update(id, (draft) => {
      draft.archived = true
      draft.updatedAt = Date.now()
    })
  }

  function toggleTodoDone(id: string) {
    const todo = todosCollection.utils.get(id)
    if (todo) {
      todosCollection.update(id, (draft) => {
        draft.done = !todo.done
        draft.updatedAt = Date.now()
      })
    }
  }

  return {
    addTodo,
    updateTodo,
    deleteTodo,
    archiveTodo,
    toggleTodoDone,
    VALID_FILTERS,
  }
})
