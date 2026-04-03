import { computed } from 'vue'
import { assert, beforeEach, test, vi } from 'vite-plus/test'

const stageImportedTodosAsMigrationInput = vi.fn()

vi.mock('@/composables/useTodoData', () => ({
  useTodoData: () => ({
    readModel: {
      todos: computed(() => [
        {
          id: 'todo-visible',
          label: 'Visible todo',
          weekNumber: 12,
          done: false,
          archived: false,
          createdAt: 10,
          updatedAt: 20,
          deviceId: 'device-1',
          userId: 'user-a',
          deletedAt: null,
        },
        {
          id: 'todo-deleted',
          label: 'Deleted todo',
          weekNumber: null,
          done: false,
          archived: false,
          createdAt: 11,
          updatedAt: 21,
          deviceId: 'device-1',
          userId: 'user-a',
          deletedAt: 21,
        },
      ]),
    },
  }),
}))

vi.mock('@/lib/todo-storage', () => ({
  stageImportedTodosAsMigrationInput,
}))

beforeEach(() => {
  vi.resetModules()
  stageImportedTodosAsMigrationInput.mockReset()
  stageImportedTodosAsMigrationInput.mockReturnValue({
    addedCount: 1,
    totalCount: 1,
  })
})

test('useDataExport exports the current visible merged todo dataset', async () => {
  const { useDataExport } = await import('./useDataExport')
  const { exportTodos } = useDataExport()

  assert.deepEqual(JSON.parse(exportTodos()), {
    todos: [
      {
        id: 'todo-visible',
        label: 'Visible todo',
        weekNumber: 12,
        done: false,
        archived: false,
        createdAt: 10,
        updatedAt: 20,
        deviceId: 'device-1',
        userId: 'user-a',
        deletedAt: null,
      },
    ],
  })
})

test('useDataExport import stages todos as guest migration input instead of overwriting the active view', async () => {
  const { useDataExport } = await import('./useDataExport')
  const { importTodos } = useDataExport()

  const result = await importTodos(
    new File(
      [
        JSON.stringify({
          todos: [
            {
              id: 'imported-todo',
              label: 'Imported todo',
              weekNumber: null,
              done: false,
              archived: false,
              createdAt: 1,
              updatedAt: 2,
              deviceId: 'device-9',
              userId: 'user-b',
              deletedAt: null,
            },
          ],
        }),
      ],
      'todos.json',
      { type: 'application/json' },
    ),
  )

  assert.deepEqual(result, {
    success: true,
    message: 'Imported 1 todo into migration staging.',
  })
  assert.deepEqual(stageImportedTodosAsMigrationInput.mock.calls[0]?.[0]?.todos, [
    {
      id: 'imported-todo',
      label: 'Imported todo',
      weekNumber: null,
      done: false,
      archived: false,
      createdAt: 1,
      updatedAt: 2,
      deviceId: 'device-9',
      userId: 'user-b',
      deletedAt: null,
    },
  ])
})

test('useDataExport import message uses the number of newly added todos instead of the total staged count', async () => {
  stageImportedTodosAsMigrationInput.mockReturnValueOnce({
    addedCount: 1,
    totalCount: 3,
  })

  const { useDataExport } = await import('./useDataExport')
  const { importTodos } = useDataExport()

  const result = await importTodos(
    new File(
      [
        JSON.stringify({
          todos: [
            {
              id: 'todo-2',
              label: 'Another todo',
              done: false,
              archived: false,
              createdAt: 1,
              updatedAt: 2,
              weekNumber: null,
              deviceId: null,
              userId: null,
              deletedAt: null,
            },
          ],
        }),
      ],
      'todos.json',
      { type: 'application/json' },
    ),
  )

  assert.deepEqual(result, {
    success: true,
    message: 'Imported 1 todo into migration staging.',
  })
})
