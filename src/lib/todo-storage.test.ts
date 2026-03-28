import assert from 'node:assert/strict'
import test from 'node:test'

import type { Todo } from '@/db/collections'

import {
  assignImportedTodos,
  claimGuestTodos,
  getAccountStorageKey,
  getActiveStorageKey,
  getGuestStorageKey,
} from './todo-storage.ts'

const guestTodo: Todo = {
  id: 'guest-todo-1',
  label: 'Claim me',
  weekNumber: 11,
  done: false,
  archived: false,
  createdAt: 100,
  updatedAt: 200,
  deviceId: 'device-1',
  userId: null,
  deletedAt: null,
}

test('getGuestStorageKey returns the guest bucket key', () => {
  assert.equal(getGuestStorageKey(), 'ai-todo-app-todos-guest')
})

test('getAccountStorageKey returns a stable user-specific key', () => {
  assert.equal(getAccountStorageKey('user-123'), 'ai-todo-app-todos-user:user-123')
})

test('getActiveStorageKey switches between guest and authenticated buckets', () => {
  assert.equal(getActiveStorageKey(null), getGuestStorageKey())
  assert.equal(getActiveStorageKey('user-123'), getAccountStorageKey('user-123'))
})

test('claimGuestTodos assigns ownership to the authenticated user', () => {
  assert.deepEqual(claimGuestTodos([guestTodo], 'user-123', 500), [
    {
      ...guestTodo,
      userId: 'user-123',
      updatedAt: 500,
    },
  ])
})

test('assignImportedTodos rewrites ownership for the active bucket', () => {
  assert.deepEqual(assignImportedTodos([guestTodo], 'user-123', 500), [
    {
      ...guestTodo,
      userId: 'user-123',
      updatedAt: 500,
    },
  ])

  assert.deepEqual(assignImportedTodos([{ ...guestTodo, userId: 'other-user' }], null, 500), [
    {
      ...guestTodo,
      userId: null,
    },
  ])
})
