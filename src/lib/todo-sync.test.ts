import assert from 'node:assert/strict'
import test from 'node:test'
import type { SyncTodo } from './todo-sync.ts'

import { buildRemoteTodoRow, shouldPushTodoForUser } from './todo-sync.ts'

const baseTodo: SyncTodo = {
  id: 'todo-1',
  label: 'Write migration',
  weekNumber: 12,
  done: false,
  archived: false,
  createdAt: 10,
  updatedAt: 20,
  deviceId: null,
  deletedAt: null,
  userId: 'user-123',
}

test('buildRemoteTodoRow includes the authenticated owner id', () => {
  assert.deepEqual(buildRemoteTodoRow(baseTodo, 'device-1'), {
    id: 'todo-1',
    label: 'Write migration',
    week_number: 12,
    done: false,
    archived: false,
    created_at: 10,
    updated_at: 20,
    device_id: 'device-1',
    deleted_at: null,
    user_id: 'user-123',
  })
})

test('buildRemoteTodoRow preserves an existing device id', () => {
  assert.equal(
    buildRemoteTodoRow({ ...baseTodo, deviceId: 'device-2' }, 'device-1').device_id,
    'device-2',
  )
})

test('shouldPushTodoForUser only syncs todos owned by the active user', () => {
  assert.equal(shouldPushTodoForUser(baseTodo, 'user-123'), true)
  assert.equal(shouldPushTodoForUser(baseTodo, 'user-999'), false)
  assert.equal(shouldPushTodoForUser({ ...baseTodo, userId: null }, 'user-123'), false)
  assert.equal(shouldPushTodoForUser(baseTodo, null), false)
})
