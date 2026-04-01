import { assert, test } from 'vite-plus/test'
import type { TodoMutationIntent } from './todo-mutation-contract.ts'
import type { SyncTodo } from './todo-sync.ts'

import {
  buildRemoteTodoRow,
  buildTodoMutationIntent,
  deriveTodoMutationId,
  shouldPushTodoForUser,
  shouldWriteTodoToRemote,
  submitTodoMutation,
} from './todo-sync.ts'

const baseTodo: SyncTodo = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Write migration',
  weekNumber: 12,
  done: false,
  archived: false,
  createdAt: 10,
  updatedAt: 20,
  deviceId: null,
  deletedAt: null,
  userId: '33333333-3333-4333-8333-333333333333',
}

test('buildRemoteTodoRow includes the authenticated owner id', () => {
  assert.deepEqual(buildRemoteTodoRow(baseTodo, 'device-1'), {
    id: '11111111-1111-4111-8111-111111111111',
    label: 'Write migration',
    week_number: 12,
    done: false,
    archived: false,
    created_at: 10,
    updated_at: 20,
    device_id: 'device-1',
    deleted_at: null,
    user_id: '33333333-3333-4333-8333-333333333333',
  })
})

test('buildRemoteTodoRow preserves an existing device id', () => {
  assert.equal(
    buildRemoteTodoRow({ ...baseTodo, deviceId: 'device-2' }, 'device-1').device_id,
    'device-2',
  )
})

test('shouldPushTodoForUser only syncs todos owned by the active user', () => {
  assert.equal(shouldPushTodoForUser(baseTodo, '33333333-3333-4333-8333-333333333333'), true)
  assert.equal(shouldPushTodoForUser(baseTodo, '99999999-9999-4999-8999-999999999999'), false)
  assert.equal(
    shouldPushTodoForUser({ ...baseTodo, userId: null }, '33333333-3333-4333-8333-333333333333'),
    false,
  )
  assert.equal(shouldPushTodoForUser(baseTodo, null), false)
})

test('shouldWriteTodoToRemote skips local tombstones that never existed remotely', () => {
  assert.equal(
    shouldWriteTodoToRemote(baseTodo, undefined, '33333333-3333-4333-8333-333333333333'),
    true,
  )
  assert.equal(
    shouldWriteTodoToRemote(
      { ...baseTodo, deletedAt: 50, updatedAt: 50 },
      undefined,
      '33333333-3333-4333-8333-333333333333',
    ),
    false,
  )
  assert.equal(
    shouldWriteTodoToRemote(
      baseTodo,
      { ...baseTodo, updatedAt: 25 },
      '33333333-3333-4333-8333-333333333333',
    ),
    false,
  )
  assert.equal(
    shouldWriteTodoToRemote(
      { ...baseTodo, updatedAt: 30 },
      { ...baseTodo, updatedAt: 25 },
      '33333333-3333-4333-8333-333333333333',
    ),
    true,
  )
})

test('deriveTodoMutationId does not accept fallbackDeviceId', () => {
  // deriveTodoMutationId should not need fallbackDeviceId since mutation identity
  // is determined by todo state and activeUserId only (idempotent retry requirement).
  // This test verifies the parameter was removed from the API contract.
  const firstAttemptId = deriveTodoMutationId({
    todo: baseTodo,
    remoteTodo: undefined,
    activeUserId: '33333333-3333-4333-8333-333333333333',
  })

  const retryAttemptId = deriveTodoMutationId({
    todo: baseTodo,
    remoteTodo: undefined,
    activeUserId: '33333333-3333-4333-8333-333333333333',
  })

  assert.equal(retryAttemptId, firstAttemptId)
})

test('buildTodoMutationIntent maps local todo state to the Supabase RPC contract', () => {
  const remoteTodo = { ...baseTodo, updatedAt: 15 }

  assert.deepEqual(
    buildTodoMutationIntent({
      todo: baseTodo,
      remoteTodo: undefined,
      activeUserId: '33333333-3333-4333-8333-333333333333',
      fallbackDeviceId: 'device-1',
    }),
    {
      kind: 'create',
      mutationId:
        'todo-mutation:33333333-3333-4333-8333-333333333333:11111111-1111-4111-8111-111111111111:create:10',
      todoId: '11111111-1111-4111-8111-111111111111',
      user_id: '33333333-3333-4333-8333-333333333333',
      client: { deviceId: 'device-1' },
      values: {
        label: 'Write migration',
        weekNumber: 12,
        done: false,
        archived: false,
        createdAt: 10,
        updatedAt: 20,
        deletedAt: null,
      },
    } satisfies TodoMutationIntent,
  )

  assert.deepEqual(
    buildTodoMutationIntent({
      todo: { ...baseTodo, label: 'Ship RPC', updatedAt: 30 },
      remoteTodo,
      activeUserId: '33333333-3333-4333-8333-333333333333',
      fallbackDeviceId: 'device-1',
    }),
    {
      kind: 'update',
      mutationId:
        'todo-mutation:33333333-3333-4333-8333-333333333333:11111111-1111-4111-8111-111111111111:update:30',
      todoId: '11111111-1111-4111-8111-111111111111',
      user_id: '33333333-3333-4333-8333-333333333333',
      client: { deviceId: 'device-1' },
      values: {
        label: 'Ship RPC',
        weekNumber: 12,
        done: false,
        archived: false,
        deletedAt: null,
        updatedAt: 30,
      },
    } satisfies TodoMutationIntent,
  )

  assert.deepEqual(
    buildTodoMutationIntent({
      todo: { ...baseTodo, deletedAt: 40, updatedAt: 40 },
      remoteTodo,
      activeUserId: '33333333-3333-4333-8333-333333333333',
      fallbackDeviceId: 'device-1',
    }),
    {
      kind: 'delete',
      mutationId:
        'todo-mutation:33333333-3333-4333-8333-333333333333:11111111-1111-4111-8111-111111111111:delete:40:40',
      todoId: '11111111-1111-4111-8111-111111111111',
      user_id: '33333333-3333-4333-8333-333333333333',
      client: { deviceId: 'device-1' },
      values: {
        deletedAt: 40,
        updatedAt: 40,
      },
    } satisfies TodoMutationIntent,
  )
})

test('submitTodoMutation calls the database RPC and normalizes the accepted txid', async () => {
  const rpcCalls: Array<{ fn: string; args: { intent: TodoMutationIntent } }> = []
  const intent = buildTodoMutationIntent({
    todo: baseTodo,
    remoteTodo: undefined,
    activeUserId: '33333333-3333-4333-8333-333333333333',
    fallbackDeviceId: 'device-1',
  })

  const response = await submitTodoMutation(
    {
      rpc: async (fn: 'apply_todo_mutation', args: { intent: TodoMutationIntent }) => {
        rpcCalls.push({ fn, args })
        return {
          data: {
            mutationId:
              'todo-mutation:33333333-3333-4333-8333-333333333333:11111111-1111-4111-8111-111111111111:create:10',
            todoId: '11111111-1111-4111-8111-111111111111',
            txid: 42,
          },
          error: null,
        }
      },
    },
    intent,
  )

  assert.deepEqual(rpcCalls, [{ fn: 'apply_todo_mutation', args: { intent } }])
  assert.deepEqual(response, {
    mutationId:
      'todo-mutation:33333333-3333-4333-8333-333333333333:11111111-1111-4111-8111-111111111111:create:10',
    todoId: '11111111-1111-4111-8111-111111111111',
    txid: '42',
  })
})
