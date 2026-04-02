import { computed } from 'vue'
import { assert, test, vi } from 'vite-plus/test'

vi.mock('./useElectricTodos', () => ({
  useElectricTodos: () => ({
    todos: computed(() => [
      {
        id: '11111111-1111-4111-8111-111111111111',
        label: 'Read only',
        weekNumber: null,
        done: false,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
        deviceId: 'device-1',
        userId: 'user-a',
        deletedAt: null,
      },
    ]),
  }),
}))

test('useTodos no longer exposes legacy direct-write helpers', async () => {
  const { useTodos } = await import('./useTodos')
  const todos = useTodos()

  assert.deepEqual(todos.getAllTodos(), [
    {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Read only',
      weekNumber: null,
      done: false,
      archived: false,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'device-1',
      userId: 'user-a',
      deletedAt: null,
    },
  ])
  assert.equal('addTodo' in todos, false)
  assert.equal('updateTodo' in todos, false)
  assert.equal('deleteTodo' in todos, false)
})
