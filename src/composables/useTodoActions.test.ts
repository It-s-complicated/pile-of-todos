import { computed, ref } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

import type { Todo } from '@/db/collections'

const updateTodo = vi.fn<(id: string, updates: Partial<Todo>) => Promise<void>>(async () => {})
const canMutateTodos = ref(true)

vi.mock('./useTodos', () => ({
  useTodos: () => ({
    canMutateTodos: computed(() => canMutateTodos.value),
    mutateTodoDisabledReason: computed(() => (canMutateTodos.value ? null : 'Sign in first.')),
    updateTodo,
  }),
}))

vi.mock('./useCurrentWeek', () => ({
  useCurrentWeek: () => ref(202646),
}))

function todo(overrides: Partial<Todo>): Todo {
  return {
    id: 'todo-1',
    label: 'Fix bike brakes',
    weekNumber: 202646,
    done: false,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    deviceId: null,
    userId: 'user-1',
    deletedAt: null,
    ...overrides,
  }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(async () => {
  updateTodo.mockClear()
  canMutateTodos.value = true
  const { useToast } = await import('./useToast')
  useToast().dismiss()
})

test('move offers an undo that only restores the week', async () => {
  const { useTodoActions } = await import('./useTodoActions')
  const { useToast } = await import('./useToast')
  const toast = useToast()

  useTodoActions().move(todo({}), 202647)
  await flush()

  assert.deepEqual(updateTodo.mock.calls[0], ['todo-1', { weekNumber: 202647 }])
  assert.equal(toast.toast.value?.message, 'Moved “Fix bike brakes” to Next week')

  toast.toast.value?.action?.run()
  await flush()

  assert.deepEqual(updateTodo.mock.calls[1], ['todo-1', { weekNumber: 202646 }])
  assert.equal(toast.toast.value, null)
})

test('moveMany skips tasks already in the target week', async () => {
  const { useTodoActions } = await import('./useTodoActions')
  const { useToast } = await import('./useToast')

  useTodoActions().moveMany(
    [todo({ id: 'a', weekNumber: 202644 }), todo({ id: 'b', weekNumber: 202646 })],
    202646,
  )
  await flush()

  assert.equal(updateTodo.mock.calls.length, 1)
  assert.deepEqual(updateTodo.mock.calls[0], ['a', { weekNumber: 202646 }])
  assert.equal(useToast().toast.value?.message, 'Moved “Fix bike brakes” to This week')
})

test('failed updates surface an error toast instead of failing silently', async () => {
  const { useTodoActions } = await import('./useTodoActions')
  const { useToast } = await import('./useToast')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  updateTodo.mockRejectedValueOnce(new Error('Queue is full'))

  useTodoActions().toggleDone(todo({}))
  await flush()

  assert.equal(useToast().toast.value?.tone, 'error')
  assert.equal(useToast().toast.value?.message, 'Queue is full')
})

test('actions are blocked with a reason when signed out', async () => {
  const { useTodoActions } = await import('./useTodoActions')
  const { useToast } = await import('./useToast')
  canMutateTodos.value = false

  useTodoActions().toggleArchived(todo({}))
  await flush()

  assert.equal(updateTodo.mock.calls.length, 0)
  assert.equal(useToast().toast.value?.message, 'Sign in first.')
})
