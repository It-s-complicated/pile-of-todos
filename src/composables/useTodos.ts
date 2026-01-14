import { db } from '../db/db'
import type { Todo } from '../types/todo'

export function useTodos() {
  async function getAllTodos(): Promise<Todo[]> {
    return await db.todos.toArray()
  }

  async function addTodo(label: string, weekNumber: number | null): Promise<string> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const todo: Todo = {
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now
    }
    await db.todos.add(todo)
    return id
  }

  async function updateTodo(id: string, updates: Partial<Todo>): Promise<void> {
    await db.todos.update(id, { ...updates, updatedAt: Date.now() })
  }

  async function deleteTodo(id: string): Promise<void> {
    await db.todos.delete(id)
  }

  async function archiveTodo(id: string): Promise<void> {
    await db.todos.update(id, { archived: true, updatedAt: Date.now() })
  }

  async function toggleTodoDone(id: string): Promise<void> {
    const todo = await db.todos.get(id)
    if (todo) {
      await db.todos.update(id, { done: !todo.done, updatedAt: Date.now() })
    }
  }

  return { getAllTodos, addTodo, updateTodo, deleteTodo, archiveTodo, toggleTodoDone }
}
