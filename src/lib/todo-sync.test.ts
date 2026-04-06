import { assert, test } from 'vite-plus/test'

import type { SyncTodo } from './todo-sync.ts'

import {
  TodoRemoteWriteError,
  buildRemoteTodoRow,
  translateRemoteTodoRow,
  updateRemoteTodo,
  upsertRemoteTodo,
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

test('translateRemoteTodoRow maps snake_case fields back to the client shape', () => {
  assert.deepEqual(
    translateRemoteTodoRow({
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Remote todo',
      week_number: 15,
      done: true,
      archived: false,
      created_at: 10,
      updated_at: 30,
      device_id: 'device-2',
      deleted_at: null,
      user_id: '33333333-3333-4333-8333-333333333333',
    }),
    {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Remote todo',
      weekNumber: 15,
      done: true,
      archived: false,
      createdAt: 10,
      updatedAt: 30,
      deviceId: 'device-2',
      deletedAt: null,
      userId: '33333333-3333-4333-8333-333333333333',
    },
  )
})

test('upsertRemoteTodo writes directly to the todos table', async () => {
  const upsertCalls: unknown[] = []

  const remoteTodo = await upsertRemoteTodo(
    {
      from: () => ({
        update: () => {
          throw new Error('unused')
        },
        upsert: (values: Record<string, unknown>, options: unknown) => {
          upsertCalls.push({ options, values })

          return {
            select: () => ({
              single: async () => ({
                data: values,
                error: null,
              }),
            }),
          }
        },
      }),
    },
    buildRemoteTodoRow(baseTodo, '33333333-3333-4333-8333-333333333333', 'device-1'),
  )

  assert.equal(upsertCalls.length, 1)
  assert.equal(remoteTodo.id, baseTodo.id)
  assert.equal(remoteTodo.userId, baseTodo.userId)
})

test('updateRemoteTodo scopes writes to the active user id', async () => {
  const eqCalls: Array<[string, string]> = []

  const remoteTodo = await updateRemoteTodo(
    {
      from: () => ({
        update: (values: Record<string, unknown>) => ({
          eq: (column: 'id', value: string) => {
            eqCalls.push([column, value])

            return {
              eq: (nextColumn: 'user_id', nextValue: string) => {
                eqCalls.push([nextColumn, nextValue])

                return {
                  select: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: '11111111-1111-4111-8111-111111111111',
                        label: 'Updated label',
                        week_number: 12,
                        done: false,
                        archived: false,
                        created_at: 10,
                        updated_at: 40,
                        device_id: 'device-1',
                        deleted_at: null,
                        user_id: '33333333-3333-4333-8333-333333333333',
                        ...values,
                      },
                      error: null,
                    }),
                  }),
                }
              },
            }
          },
        }),
        upsert: () => {
          throw new Error('unused')
        },
      }),
    },
    {
      activeUserId: '33333333-3333-4333-8333-333333333333',
      todoId: '11111111-1111-4111-8111-111111111111',
      updates: {
        label: 'Updated label',
        updatedAt: 40,
      },
    },
  )

  assert.deepEqual(eqCalls, [
    ['id', '11111111-1111-4111-8111-111111111111'],
    ['user_id', '33333333-3333-4333-8333-333333333333'],
  ])
  assert.equal(remoteTodo.label, 'Updated label')
  assert.equal(remoteTodo.updatedAt, 40)
})

test('updateRemoteTodo throws a not-found error when no row matches the active user scope', async () => {
  try {
    await updateRemoteTodo(
      {
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          upsert: () => {
            throw new Error('unused')
          },
        }),
      },
      {
        activeUserId: '33333333-3333-4333-8333-333333333333',
        todoId: '11111111-1111-4111-8111-111111111111',
        updates: {
          updatedAt: 40,
        },
      },
    )
    assert.fail('Expected updateRemoteTodo to reject')
  } catch (error) {
    assert.equal(error instanceof TodoRemoteWriteError, true)
    assert.equal(error instanceof TodoRemoteWriteError ? error.kind : null, 'not-found')
    assert.match(error instanceof Error ? error.message : String(error), /approved account/)
  }
})
