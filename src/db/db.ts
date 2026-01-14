import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Todo } from '../types/todo'

export class TodoDatabase extends Dexie {
  todos!: Table<Todo, string>

  constructor() {
    super('TodoAppDB')
    this.version(1).stores({
      todos: 'id, weekNumber, done, archived, createdAt, updatedAt'
    })
  }
}

export const db = new TodoDatabase()
