import { computed, effectScope, nextTick, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

import type { ConfirmedTodoRow } from '@/db/confirmed-todos'
import type { Todo } from '@/db/collections'

const accessState = ref<'signed-in' | 'signed-out'>('signed-out')
const isAuthReady = ref(false)
const userId = ref<string | null>(null)
const isQueryReady = ref(true)
const confirmedRows = ref<ConfirmedTodoRow[]>([])
const pendingMutations = ref([])
const refreshConfirmedTodos = vi.fn<() => Promise<void>>(async () => undefined)

vi.mock('@tanstack/vue-db', () => ({
  eq: vi.fn<() => undefined>(),
  useLiveQuery: () => ({ data: confirmedRows, isReady: isQueryReady }),
}))

vi.mock('@/db/confirmed-todos', () => ({
  getConfirmedTodosCollection: () => ({}),
  mapConfirmedTodoRow: (row: ConfirmedTodoRow): Todo => ({
    id: row.id,
    label: row.label,
    weekNumber: row.week_number,
    done: row.done,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deviceId: row.device_id,
    userId: row.user_id,
    deletedAt: row.deleted_at,
  }),
  refreshConfirmedTodos,
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ accessState, isAuthReady, userId }),
}))

vi.mock('./useTodoCreateQueueController', () => ({
  useTodoMutationQueueController: () => ({
    pendingMutations: computed(() => pendingMutations.value),
  }),
}))

const userARow: ConfirmedTodoRow = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'User A todo',
  week_number: null,
  done: false,
  archived: false,
  created_at: 10,
  updated_at: 20,
  device_id: null,
  user_id: 'user-a',
  deleted_at: null,
}

beforeEach(() => {
  vi.resetModules()
  accessState.value = 'signed-out'
  isAuthReady.value = false
  userId.value = null
  isQueryReady.value = true
  confirmedRows.value = []
  pendingMutations.value = []
  refreshConfirmedTodos.mockClear()
})

test('useTodoReadModel treats a signed-out scope as a ready empty snapshot', async () => {
  confirmedRows.value = [userARow]
  isAuthReady.value = true
  const { useTodoReadModel } = await import('./useTodoReadModel')
  const scope = effectScope()
  const readModel = scope.run(() => useTodoReadModel())!

  assert.deepEqual(readModel.confirmedTodos.value, [])
  assert.equal(readModel.isReady.value, true)
  scope.stop()
})

test('useTodoReadModel refetches restored sessions and hides switched-user rows', async () => {
  confirmedRows.value = [userARow]
  const { useTodoReadModel } = await import('./useTodoReadModel')
  const scope = effectScope()
  const readModel = scope.run(() => useTodoReadModel())!

  assert.deepEqual(readModel.confirmedTodos.value, [])
  assert.equal(readModel.isReady.value, false)

  accessState.value = 'signed-in'
  userId.value = 'user-a'
  isAuthReady.value = true
  await nextTick()

  assert.equal(readModel.confirmedTodos.value[0]?.label, 'User A todo')
  assert.equal(refreshConfirmedTodos.mock.calls.length, 1)

  userId.value = 'user-b'
  await nextTick()

  assert.deepEqual(readModel.confirmedTodos.value, [])

  confirmedRows.value = [{ ...userARow, id: 'todo-b', label: 'User B todo', user_id: 'user-b' }]
  await nextTick()

  assert.equal(readModel.confirmedTodos.value[0]?.label, 'User B todo')
  assert.equal(refreshConfirmedTodos.mock.calls.length, 2)

  confirmedRows.value = []
  assert.deepEqual(readModel.confirmedTodos.value, [])
  scope.stop()
})
