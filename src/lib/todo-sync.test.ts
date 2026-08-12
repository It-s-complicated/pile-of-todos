import { assert, test } from 'vite-plus/test'

import type { SyncTodo } from './todo-sync.ts'

import {
  TodoRemoteWriteError,
  buildRemoteTodoRow,
  updateRemoteTodo,
  upsertRemoteTodo,
} from './todo-sync.ts'

type RpcError = {
  code?: string
  details?: string | null
  hint?: string | null
  message: string
}

type RpcIntent = {
  client: {
    deviceId: string | null
  }
  kind: string
  mutationId: string
  todoId: string
  values: Record<string, unknown>
}

type RpcCall = {
  functionName: 'apply_todo_mutation'
  params: {
    intent: RpcIntent
  }
}

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

function createRpcClient(response: { data?: unknown; error?: RpcError | null }, calls: RpcCall[]) {
  return {
    rpc: async (
      functionName: 'apply_todo_mutation',
      params: {
        intent: RpcIntent
      },
    ) => {
      calls.push({ functionName, params })

      return {
        data: response.data ?? null,
        error: response.error ?? null,
      }
    },
  }
}

test('buildRemoteTodoRow includes the authenticated owner id', () => {
  assert.deepEqual(
    buildRemoteTodoRow(baseTodo, '33333333-3333-4333-8333-333333333333', 'device-1'),
    {
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
    },
  )
})

test('buildRemoteTodoRow rejects todos outside the active user scope', () => {
  assert.throws(
    () => buildRemoteTodoRow(baseTodo, '99999999-9999-4999-8999-999999999999', 'device-1'),
    /active user scope/,
  )
})

test('upsertRemoteTodo sends create mutations through the RPC', async () => {
  const rpcCalls: RpcCall[] = []

  const accepted = await upsertRemoteTodo(
    createRpcClient(
      {
        data: {
          mutationId: 'mutation-1',
          todoId: baseTodo.id,
          txid: '123',
        },
        error: null,
      },
      rpcCalls,
    ),
    buildRemoteTodoRow(baseTodo, '33333333-3333-4333-8333-333333333333', 'device-1'),
  )

  assert.deepEqual(accepted, { mutationId: 'mutation-1', todoId: baseTodo.id })
  assert.equal(rpcCalls.length, 1)
  assert.deepEqual(rpcCalls[0]?.params.intent.kind, 'create')
  assert.equal(rpcCalls[0]?.params.intent.todoId, baseTodo.id)
  assert.equal(rpcCalls[0]?.params.intent.client.deviceId, 'device-1')
  assert.match(rpcCalls[0]?.params.intent.mutationId ?? '', /.+/)
  assert.deepEqual(rpcCalls[0]?.params.intent.values, {
    archived: false,
    createdAt: 10,
    deletedAt: null,
    done: false,
    label: 'Write migration',
    updatedAt: 20,
    weekNumber: 12,
  })
})

test('upsertRemoteTodo surfaces row-level security failures as auth errors', async () => {
  try {
    await upsertRemoteTodo(
      createRpcClient(
        {
          error: {
            code: '42501',
            message: 'new row violates row-level security policy for table "todos"',
            details: null,
            hint: null,
          },
        },
        [],
      ),
      buildRemoteTodoRow(baseTodo, '33333333-3333-4333-8333-333333333333', 'device-1'),
    )
    assert.fail('Expected upsertRemoteTodo to reject')
  } catch (error) {
    assert.equal(error instanceof TodoRemoteWriteError, true)
    assert.equal(error instanceof TodoRemoteWriteError ? error.kind : null, 'auth')
  }
})

test('updateRemoteTodo sends update mutations through the RPC', async () => {
  const rpcCalls: RpcCall[] = []

  await updateRemoteTodo(
    createRpcClient(
      {
        data: {
          mutationId: 'mutation-2',
          todoId: baseTodo.id,
          txid: '456',
        },
        error: null,
      },
      rpcCalls,
    ),
    {
      activeUserId: '33333333-3333-4333-8333-333333333333',
      todoId: baseTodo.id,
      updates: {
        archived: true,
        deletedAt: null,
        deviceId: 'device-1',
        done: true,
        label: 'Updated label',
        updatedAt: 40,
        weekNumber: null,
      },
    },
  )

  assert.equal(rpcCalls.length, 1)
  assert.deepEqual(rpcCalls[0]?.params.intent.kind, 'update')
  assert.equal(rpcCalls[0]?.params.intent.todoId, baseTodo.id)
  assert.equal(rpcCalls[0]?.params.intent.client.deviceId, 'device-1')
  assert.match(rpcCalls[0]?.params.intent.mutationId ?? '', /.+/)
  assert.deepEqual(rpcCalls[0]?.params.intent.values, {
    archived: true,
    deletedAt: null,
    done: true,
    label: 'Updated label',
    updatedAt: 40,
    weekNumber: null,
  })
})

test('updateRemoteTodo throws a not-found error when the RPC reports a missing todo', async () => {
  try {
    await updateRemoteTodo(
      createRpcClient(
        {
          error: {
            code: 'P0001',
            message:
              'todo 11111111-1111-4111-8111-111111111111 was not found for the authenticated user',
            details: null,
            hint: null,
          },
        },
        [],
      ),
      {
        activeUserId: '33333333-3333-4333-8333-333333333333',
        todoId: baseTodo.id,
        updates: {
          updatedAt: 40,
        },
      },
    )
    assert.fail('Expected updateRemoteTodo to reject')
  } catch (error) {
    assert.equal(error instanceof TodoRemoteWriteError, true)
    assert.equal(error instanceof TodoRemoteWriteError ? error.kind : null, 'not-found')
    assert.match(error instanceof Error ? error.message : String(error), /not found/)
  }
})
