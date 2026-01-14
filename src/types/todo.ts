export interface Todo {
  id: string
  label: string
  weekNumber: number | null
  done: boolean
  archived: boolean
  createdAt: number
  updatedAt: number
}

export type TodoFilter = 'backlog' | 'current-week' | 'future' | 'unfinished' | 'archived' | 'finished'
