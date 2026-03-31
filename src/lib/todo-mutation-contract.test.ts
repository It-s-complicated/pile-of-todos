import { assert, test } from 'vite-plus/test'

import {
  TODO_MUTATION_IDEMPOTENCY,
  TODO_MUTATION_STATUSES,
  parseTodoMutationIntent,
  parseTodoMutationResponse,
  parseTodoMutationStatus,
} from './todo-mutation-contract.ts'

const todoId = '11111111-1111-4111-8111-111111111111'
const secondTodoId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'

test('parseTodoMutationIntent accepts create update and delete intents', () => {
  const createIntent = parseTodoMutationIntent({
    kind: 'create',
    mutationId: 'mutation-create-1',
    todoId,
    user_id: userId,
    client: {
      deviceId: 'device-1',
    },
    values: {
      label: 'Write contract tests',
      weekNumber: 14,
      done: false,
      archived: false,
      createdAt: 100,
      updatedAt: 100,
      deletedAt: null,
    },
  })

  const updateIntent = parseTodoMutationIntent({
    kind: 'update',
    mutationId: 'mutation-update-1',
    todoId,
    user_id: userId,
    values: {
      label: 'Ship contract module',
      deletedAt: null,
      updatedAt: 200,
    },
  })

  const deleteIntent = parseTodoMutationIntent({
    kind: 'delete',
    mutationId: 'mutation-delete-1',
    todoId,
    user_id: userId,
    values: {
      deletedAt: 300,
      updatedAt: 300,
    },
  })

  assert.deepEqual(createIntent, {
    kind: 'create',
    mutationId: 'mutation-create-1',
    todoId,
    user_id: userId,
    client: {
      deviceId: 'device-1',
    },
    values: {
      label: 'Write contract tests',
      weekNumber: 14,
      done: false,
      archived: false,
      createdAt: 100,
      updatedAt: 100,
      deletedAt: null,
    },
  })
  assert.equal(updateIntent.kind, 'update')
  assert.deepEqual(updateIntent.values, {
    label: 'Ship contract module',
    deletedAt: null,
    updatedAt: 200,
  })
  assert.deepEqual(deleteIntent.values, {
    deletedAt: 300,
    updatedAt: 300,
  })
})

test('parseTodoMutationIntent rejects update intents without mutated fields', () => {
  assert.throws(
    () =>
      parseTodoMutationIntent({
        kind: 'update',
        mutationId: 'mutation-update-2',
        todoId,
        user_id: userId,
        values: {
          updatedAt: 200,
        },
      }),
    /at least one mutated field/i,
  )
})

test('parseTodoMutationIntent only allows tombstones through delete intents', () => {
  assert.throws(
    () =>
      parseTodoMutationIntent({
        kind: 'create',
        mutationId: 'mutation-create-2',
        todoId: secondTodoId,
        user_id: userId,
        values: {
          label: 'Should not create tombstones',
          weekNumber: null,
          done: false,
          archived: false,
          createdAt: 100,
          updatedAt: 123,
          deletedAt: 123,
        },
      }),
    /create intents may only use deletedAt null/i,
  )

  assert.throws(
    () =>
      parseTodoMutationIntent({
        kind: 'update',
        mutationId: 'mutation-update-3',
        todoId,
        user_id: userId,
        values: {
          deletedAt: 300,
          updatedAt: 300,
        },
      }),
    /delete intents must carry tombstones/i,
  )
})

test('parseTodoMutationResponse normalizes txid to a string contract', () => {
  assert.deepEqual(
    parseTodoMutationResponse({
      mutationId: 'mutation-create-1',
      todoId,
      txid: 42,
    }),
    {
      mutationId: 'mutation-create-1',
      todoId,
      txid: '42',
    },
  )

  assert.equal(
    parseTodoMutationResponse({
      mutationId: 'mutation-create-1',
      todoId,
      txid: '43',
    }).txid,
    '43',
  )
})

test('parseTodoMutationResponse requires the accepted write txid contract', () => {
  assert.throws(
    () =>
      parseTodoMutationResponse({
        mutationId: 'mutation-create-1',
        todoId,
        txid: 0,
      }),
    />=1|received 0/i,
  )

  assert.throws(
    () =>
      parseTodoMutationResponse({
        mutationId: 'mutation-create-1',
        todoId,
        txid: '0',
      }),
    /txid/i,
  )

  assert.throws(
    () =>
      parseTodoMutationResponse({
        mutationId: 'mutation-create-1',
        todoId,
      }),
    /txid/i,
  )

  assert.throws(
    () =>
      parseTodoMutationResponse({
        mutationId: 'mutation-create-1',
        todoId,
        txid: 42,
        status: 'confirmed',
      }),
    /unknown/i,
  )
})

test('status and idempotency constants preserve accepted versus confirmed semantics', () => {
  assert.deepEqual(TODO_MUTATION_STATUSES, [
    'queued',
    'sending',
    'accepted-awaiting-sync',
    'confirmed',
    'retryable-error',
    'rejected',
  ])

  assert.equal(parseTodoMutationStatus('accepted-awaiting-sync'), 'accepted-awaiting-sync')

  assert.deepEqual(TODO_MUTATION_IDEMPOTENCY, {
    mutationIdSurvivesRetries: true,
    createUsesStableTodoId: true,
    duplicateEffectKey: 'todoId+mutationId',
    enforcedBy: 'supabase-db-layer',
    acceptedWriteRequiresTxid: true,
    txidRepresents: 'postgres-acceptance',
    confirmationSource: 'electric-sync',
    supportsUserPartitionedPendingWork: true,
  })
})

test('strict contract parsers reject invalid statuses and unknown intent keys', () => {
  assert.throws(() => parseTodoMutationStatus('done'), /invalid/i)

  assert.throws(
    () =>
      parseTodoMutationIntent({
        kind: 'create',
        mutationId: 'mutation-create-3',
        todoId: 'not-a-uuid',
        user_id: userId,
        values: {
          label: 'Bad todo id',
          weekNumber: null,
          done: false,
          archived: false,
          createdAt: 100,
          updatedAt: 100,
          deletedAt: null,
        },
      }),
    /uuid/i,
  )

  assert.throws(
    () =>
      parseTodoMutationIntent({
        kind: 'delete',
        mutationId: 'mutation-delete-2',
        todoId,
        user_id: userId,
        extra: true,
        values: {
          deletedAt: 400,
          updatedAt: 400,
        },
      }),
    /invalid key|unknown/i,
  )
})
