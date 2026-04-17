import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import type { QueuedTodoMutation } from '@/lib/offline-todo-mutation-queue'

const activeUserId = ref<string | null>('user-a')
const todos = ref<Todo[]>([])

const queueMutation = vi.fn<(mutation: QueuedTodoMutation) => void>()

vi.mock('./useTodoData', () => ({
  useTodoData: () => ({
    auth: {
      activeUserId: computed(() => activeUserId.value),
    },
    connectivity: {
      isOnline: computed(() => true),
    },
    readModel: {
      todos: computed(() => todos.value),
    },
    sync: {
      controller: {
        queueMutation,
      },
    },
  }),
}))

const confirmedTodo: Todo = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Confirmed todo',
  weekNumber: 12,
  done: false,
  archived: false,
  createdAt: 10,
  updatedAt: 20,
  deviceId: 'device-1',
  userId: 'user-a',
  deletedAt: null,
}

beforeEach(() => {
  vi.resetModules()
  activeUserId.value = 'user-a'
  todos.value = [confirmedTodo]
  queueMutation.mockReset()
})

test('useTodoMutations queues creates immediately for optimistic replay', async () => {
  const { useTodoMutations } = await import('./useTodoMutations')

  const todoId = await useTodoMutations().createTodo('Queued todo', 12)
  const mutation = queueMutation.mock.calls[0]?.[0]

  assert.equal(queueMutation.mock.calls.length, 1)
  assert.equal(mutation?.kind, 'create')

  if (!mutation || mutation.kind !== 'create') {
    assert.fail('Expected a queued create mutation')
  }

  assert.equal(mutation.optimisticTodo.label, 'Queued todo')
  assert.equal(mutation.optimisticTodo.id, todoId)
})

test('useTodoMutations queues updates against the merged read model', async () => {
  const { useTodoMutations } = await import('./useTodoMutations')

  await useTodoMutations().updateTodo(confirmedTodo.id, {
    done: true,
    weekNumber: null,
  })
  const mutation = queueMutation.mock.calls[0]?.[0]

  assert.equal(queueMutation.mock.calls.length, 1)
  assert.equal(mutation?.kind, 'update')

  if (!mutation || mutation.kind !== 'update') {
    assert.fail('Expected a queued update mutation')
  }

  assert.equal(mutation.todoId, confirmedTodo.id)
  assert.equal(mutation.updates.done, true)
  assert.equal(mutation.updates.weekNumber, null)
})

test('useTodoMutations queues deletes as durable pending mutations', async () => {
  const { useTodoMutations } = await import('./useTodoMutations')

  await useTodoMutations().deleteTodo(confirmedTodo.id)
  const mutation = queueMutation.mock.calls[0]?.[0]

  assert.equal(queueMutation.mock.calls.length, 1)
  assert.equal(mutation?.kind, 'delete')

  if (!mutation || mutation.kind !== 'delete') {
    assert.fail('Expected a queued delete mutation')
  }

  assert.equal(mutation.todoId, confirmedTodo.id)
  assert.equal(typeof mutation.updates.deletedAt, 'number')
})

test('useTodoMutations rejects writes when there is no signed-in account', async () => {
  activeUserId.value = null
  const { useTodoMutations } = await import('./useTodoMutations')

  await assertRejectedWithMessage(
    useTodoMutations().createTodo('Should fail', null),
    /without a signed-in account/,
  )
  assert.equal(queueMutation.mock.calls.length, 0)
})

async function assertRejectedWithMessage(promise: Promise<unknown>, pattern: RegExp) {
  try {
    await promise
    assert.fail('Expected promise to reject')
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), pattern)
  }
}
