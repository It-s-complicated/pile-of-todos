import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'

import {
  declineStagedMigrationTodos,
  ensureStagedTodoPromotionId,
  getAccountStorageKey,
  getActiveStorageKey,
  getGuestStorageKey,
  getMigrationInputStorageKey,
  migrateLegacyBucketsToGuestMigrationInput,
  readMigrationInputTodos,
  readTodoMigrationState,
  removeConfirmedPromotedStagedTodos,
  markStagedMigrationPromoting,
  stageImportedTodosAsMigrationInput,
} from './todo-storage.ts'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

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

test('migrateLegacyBucketsToGuestMigrationInput stages legacy buckets as signed-out migration input', () => {
  const storage = createMemoryStorage()

  storage.setItem(getGuestStorageKey(), JSON.stringify([guestTodo]))
  storage.setItem(
    getAccountStorageKey('user-123'),
    JSON.stringify([{ ...guestTodo, id: 'account-todo-1', userId: 'user-123' }]),
  )

  const stagedCount = migrateLegacyBucketsToGuestMigrationInput({ storage })

  assert.equal(stagedCount, 2)
  assert.equal(storage.getItem(getGuestStorageKey()), null)
  assert.equal(storage.getItem(getAccountStorageKey('user-123')), null)
  assert.deepEqual(readMigrationInputTodos({ storage }), [
    guestTodo,
    {
      ...guestTodo,
      id: 'account-todo-1',
      userId: null,
    },
  ])
})

test('stageImportedTodosAsMigrationInput appends imported todos into the guest migration bucket', () => {
  const storage = createMemoryStorage()

  storage.setItem(getMigrationInputStorageKey(), JSON.stringify([guestTodo]))

  const result = stageImportedTodosAsMigrationInput({
    storage,
    todos: [{ ...guestTodo, id: 'imported-todo-1', userId: 'other-user' }],
  })

  assert.deepEqual(result, {
    addedCount: 1,
    totalCount: 2,
  })
  assert.deepEqual(readMigrationInputTodos({ storage }), [
    guestTodo,
    {
      ...guestTodo,
      id: 'imported-todo-1',
      userId: null,
    },
  ])
})

test('readMigrationInputTodos fails soft when migration storage is malformed', () => {
  const storage = createMemoryStorage()

  storage.setItem(getMigrationInputStorageKey(), '{not valid json')

  assert.deepEqual(readMigrationInputTodos({ storage }), [])
  assert.equal(storage.getItem(getMigrationInputStorageKey()), '{not valid json')
})

test('migrateLegacyBucketsToGuestMigrationInput skips malformed legacy buckets without throwing', () => {
  const storage = createMemoryStorage()

  storage.setItem(getGuestStorageKey(), '{not valid json')
  storage.setItem(getAccountStorageKey('user-123'), JSON.stringify([guestTodo]))

  const stagedCount = migrateLegacyBucketsToGuestMigrationInput({ storage })

  assert.equal(stagedCount, 1)
  assert.equal(storage.getItem(getGuestStorageKey()), '{not valid json')
  assert.equal(storage.getItem(getAccountStorageKey('user-123')), null)
  assert.deepEqual(readMigrationInputTodos({ storage }), [guestTodo])
})

test('todo migration state persists staged availability across reloads', () => {
  const storage = createMemoryStorage()

  stageImportedTodosAsMigrationInput({
    storage,
    todos: [guestTodo],
  })

  assert.deepEqual(readTodoMigrationState({ storage }), {
    promotedTodoIdsBySourceId: {},
    stagedTodos: [guestTodo],
    status: 'available',
  })
})

test('ensureStagedTodoPromotionId reuses the same generated uuid for a staged row', () => {
  const storage = createMemoryStorage()

  stageImportedTodosAsMigrationInput({
    storage,
    todos: [guestTodo],
  })

  const createTodoId = () => '11111111-1111-4111-8111-111111111111'

  const firstPromotionId = ensureStagedTodoPromotionId({
    createTodoId,
    stagedTodoId: guestTodo.id,
    storage,
  })
  const secondPromotionId = ensureStagedTodoPromotionId({
    createTodoId: () => '22222222-2222-4222-8222-222222222222',
    stagedTodoId: guestTodo.id,
    storage,
  })

  assert.equal(firstPromotionId, '11111111-1111-4111-8111-111111111111')
  assert.equal(secondPromotionId, '11111111-1111-4111-8111-111111111111')
  assert.deepEqual(readTodoMigrationState({ storage }).promotedTodoIdsBySourceId, {
    [guestTodo.id]: '11111111-1111-4111-8111-111111111111',
  })
})

test('declineStagedMigrationTodos persists quarantine state across reloads', () => {
  const storage = createMemoryStorage()

  stageImportedTodosAsMigrationInput({
    storage,
    todos: [guestTodo],
  })
  declineStagedMigrationTodos({ storage })

  assert.deepEqual(readTodoMigrationState({ storage }), {
    promotedTodoIdsBySourceId: {},
    stagedTodos: [guestTodo],
    status: 'declined',
  })
})

test('removeConfirmedPromotedStagedTodos only removes staged rows whose promoted ids were confirmed', () => {
  const storage = createMemoryStorage()
  const secondTodo = {
    ...guestTodo,
    id: 'guest-todo-2',
    label: 'Keep me staged',
  }

  stageImportedTodosAsMigrationInput({
    storage,
    todos: [guestTodo, secondTodo],
  })
  ensureStagedTodoPromotionId({
    createTodoId: () => '11111111-1111-4111-8111-111111111111',
    stagedTodoId: guestTodo.id,
    storage,
  })
  ensureStagedTodoPromotionId({
    createTodoId: () => '22222222-2222-4222-8222-222222222222',
    stagedTodoId: secondTodo.id,
    storage,
  })
  markStagedMigrationPromoting({ storage })

  removeConfirmedPromotedStagedTodos({
    confirmedTodoIds: ['11111111-1111-4111-8111-111111111111'],
    storage,
  })

  assert.deepEqual(readTodoMigrationState({ storage }), {
    promotedTodoIdsBySourceId: {
      [secondTodo.id]: '22222222-2222-4222-8222-222222222222',
    },
    stagedTodos: [secondTodo],
    status: 'promoting',
  })
})
