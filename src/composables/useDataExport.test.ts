import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'

const mockCreateTodo = vi
  .fn<(label: string, weekNumber: number | null, id?: string) => Promise<string>>()
  .mockResolvedValue('new-id')

const mockIsAuthenticated = { value: true }

const mockReadModelTodos = {
  value: [
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
  ] as any[],
}

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}))

vi.mock('@/composables/useTodoMutations', () => ({
  useTodoMutations: () => ({
    createTodo: mockCreateTodo,
  }),
}))

vi.mock('@/composables/useTodoData', () => ({
  useTodoData: () => ({
    readModel: {
      confirmedTodos: mockReadModelTodos,
      todos: mockReadModelTodos,
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  mockCreateTodo.mockReset()
  mockCreateTodo.mockResolvedValue('new-id')
  mockIsAuthenticated.value = true
  mockReadModelTodos.value = [
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
  ]
})

describe('useDataExport exportTodos', () => {
  test('exports only visible (non-deleted) todos', async () => {
    const { useDataExport } = await import('./useDataExport')
    const { exportTodos } = useDataExport()

    const result = JSON.parse(exportTodos())
    expect(result.todos).toHaveLength(1)
    expect(result.todos[0].id).toBe('todo-visible')
  })
})

describe('useDataExport importTodos', () => {
  test('successfully imports valid todos with original IDs preserved', async () => {
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

    expect(result).toEqual({
      success: true,
      message: 'Imported 1 todo',
    })
    expect(mockCreateTodo).toHaveBeenCalledWith('Imported todo', null, 'imported-todo')
  })

  test('imports multiple todos and preserves all IDs', async () => {
    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File(
        [
          JSON.stringify({
            todos: [
              {
                id: 'todo-1',
                label: 'First todo',
                weekNumber: 10,
                done: false,
                archived: false,
                createdAt: 1,
                updatedAt: 2,
                deviceId: 'device-1',
                userId: 'user-1',
                deletedAt: null,
              },
              {
                id: 'todo-2',
                label: 'Second todo',
                weekNumber: 11,
                done: true,
                archived: false,
                createdAt: 3,
                updatedAt: 4,
                deviceId: 'device-2',
                userId: 'user-2',
                deletedAt: null,
              },
            ],
          }),
        ],
        'todos.json',
        { type: 'application/json' },
      ),
    )

    expect(result).toEqual({
      success: true,
      message: 'Imported 2 todos',
    })
    expect(mockCreateTodo).toHaveBeenCalledTimes(2)
    expect(mockCreateTodo).toHaveBeenNthCalledWith(1, 'First todo', 10, 'todo-1')
    expect(mockCreateTodo).toHaveBeenNthCalledWith(2, 'Second todo', 11, 'todo-2')
  })

  test('returns error when user is not authenticated', async () => {
    mockIsAuthenticated.value = false

    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File(
        [
          JSON.stringify({
            todos: [
              {
                id: 'todo-1',
                label: 'Test todo',
                weekNumber: null,
                done: false,
                archived: false,
                createdAt: 1,
                updatedAt: 2,
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

    expect(result).toEqual({
      success: false,
      message: 'Please sign in to import todos',
    })
    expect(mockCreateTodo).not.toHaveBeenCalled()

    mockIsAuthenticated.value = true
  })

  test('halts import when validation fails at a specific index', async () => {
    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File(
        [
          JSON.stringify({
            todos: [
              {
                id: 'valid-todo',
                label: 'Valid todo',
                weekNumber: null,
                done: false,
                archived: false,
                createdAt: 1,
                updatedAt: 2,
                deviceId: null,
                userId: null,
                deletedAt: null,
              },
              {
                id: '',
                label: '',
                weekNumber: null,
                done: false,
                archived: false,
                createdAt: 3,
                updatedAt: 4,
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

    expect(result.success).toBe(false)
    expect(result.message).toContain('Invalid todo')
    expect(result.message).toContain('id')
    expect(mockCreateTodo).not.toHaveBeenCalled()
  })

  test('fails when duplicate ID appears twice in the same import batch', async () => {
    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File(
        [
          JSON.stringify({
            todos: [
              {
                id: 'duplicate-id',
                label: 'First occurrence',
                weekNumber: null,
                done: false,
                archived: false,
                createdAt: 1,
                updatedAt: 2,
                deviceId: null,
                userId: null,
                deletedAt: null,
              },
              {
                id: 'duplicate-id',
                label: 'Second occurrence',
                weekNumber: null,
                done: false,
                archived: false,
                createdAt: 3,
                updatedAt: 4,
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

    expect(result).toEqual({
      success: false,
      message: 'Duplicate ID: duplicate-id',
    })
    expect(mockCreateTodo).not.toHaveBeenCalled()
  })

  test('fails when imported ID already exists in the merged read model', async () => {
    mockReadModelTodos.value = [
      {
        id: 'existing-id',
        label: 'Already exists',
        weekNumber: null,
        done: false,
        archived: false,
        createdAt: 1,
        updatedAt: 2,
        deviceId: null,
        userId: null,
        deletedAt: null,
      },
    ]

    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File(
        [
          JSON.stringify({
            todos: [
              {
                id: 'existing-id',
                label: 'Duplicate from file',
                weekNumber: null,
                done: false,
                archived: false,
                createdAt: 5,
                updatedAt: 6,
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

    expect(result).toEqual({
      success: false,
      message: 'Duplicate ID: existing-id',
    })
    expect(mockCreateTodo).not.toHaveBeenCalled()
  })

  test('handles invalid JSON gracefully', async () => {
    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File(['not valid json{'], 'todos.json', { type: 'application/json' }),
    )

    expect(result.success).toBe(false)
    expect(result.message).toBe('Unexpected token \'o\', "not valid json{" is not valid JSON')
    expect(mockCreateTodo).not.toHaveBeenCalled()
  })

  test('handles missing todos array gracefully', async () => {
    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File([JSON.stringify({})], 'todos.json', { type: 'application/json' }),
    )

    expect(result.success).toBe(false)
    expect(result.message).toBe(
      'Import file must contain a todo array or an object with a todos array',
    )
    expect(mockCreateTodo).not.toHaveBeenCalled()
  })

  test('handles plain array format (without wrapper object)', async () => {
    const { useDataExport } = await import('./useDataExport')
    const { importTodos } = useDataExport()

    const result = await importTodos(
      new File(
        [
          JSON.stringify([
            {
              id: 'array-format-todo',
              label: 'Imported from array',
              weekNumber: null,
              done: false,
              archived: false,
              createdAt: 1,
              updatedAt: 2,
              deviceId: null,
              userId: null,
              deletedAt: null,
            },
          ]),
        ],
        'todos.json',
        { type: 'application/json' },
      ),
    )

    expect(result).toEqual({
      success: true,
      message: 'Imported 1 todo',
    })
    expect(mockCreateTodo).toHaveBeenCalledWith('Imported from array', null, 'array-format-todo')
  })
})
