import type { Todo } from '@/db/collections'

const GUEST_STORAGE_KEY = 'ai-todo-app-todos-guest'
const ACCOUNT_STORAGE_KEY_PREFIX = 'ai-todo-app-todos-user:'

export function getGuestStorageKey(): string {
  return GUEST_STORAGE_KEY
}

export function getAccountStorageKey(userId: string): string {
  return `${ACCOUNT_STORAGE_KEY_PREFIX}${userId}`
}

export function getActiveStorageKey(userId: string | null): string {
  return userId ? getAccountStorageKey(userId) : getGuestStorageKey()
}

export function claimGuestTodos(todos: Todo[], userId: string, now: number): Todo[] {
  return todos.map((todo) => ({
    ...todo,
    userId,
    updatedAt: now,
  }))
}

export function assignImportedTodos(todos: Todo[], userId: string | null, now: number): Todo[] {
  return todos.map((todo) => ({
    ...todo,
    userId,
    updatedAt: userId ? now : todo.updatedAt,
  }))
}
