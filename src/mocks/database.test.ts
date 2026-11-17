import { describe, expect, it } from 'vite-plus/test'

import { createMockDatabase, PostgrestMockError } from './database'
import { queryRows, UnsupportedQueryError } from './postgrest'

const USER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const TODO_ID = '11111111-1111-4111-8111-111111111111'

function createIntent(mutationId = 'm-1') {
  return {
    kind: 'create',
    mutationId,
    todoId: TODO_ID,
    client: { deviceId: 'test' },
    values: { label: 'Water the plants', done: false, archived: false, createdAt: 1, updatedAt: 1 },
  }
}

describe('mock database', () => {
  it('seeds todos for the mock user only', () => {
    const database = createMockDatabase(null, USER)

    expect(database.selectTodos(USER).length).toBeGreaterThan(0)
    expect(database.selectTodos(OTHER)).toEqual([])
    expect(database.selectTodos(null)).toEqual([])
  })

  it('applies create, update and delete intents', () => {
    const database = createMockDatabase(null, USER)
    const created = database.applyTodoMutation(createIntent(), USER)

    expect(created).toMatchObject({ mutationId: 'm-1', todoId: TODO_ID })

    database.applyTodoMutation(
      { kind: 'update', mutationId: 'm-2', todoId: TODO_ID, values: { done: true, updatedAt: 2 } },
      USER,
    )
    expect(database.selectTodos(USER).find((row) => row.id === TODO_ID)).toMatchObject({
      done: true,
      updated_at: 2,
    })

    database.applyTodoMutation(
      {
        kind: 'delete',
        mutationId: 'm-3',
        todoId: TODO_ID,
        values: { deletedAt: 3, updatedAt: 3 },
      },
      USER,
    )
    expect(database.selectTodos(USER).find((row) => row.id === TODO_ID)?.deleted_at).toBe(3)
  })

  it('replays a mutation id instead of applying it twice', () => {
    const database = createMockDatabase(null, USER)
    const first = database.applyTodoMutation(createIntent(), USER)

    expect(database.applyTodoMutation(createIntent(), USER)).toEqual(first)
    expect(database.selectTodos(USER).filter((row) => row.id === TODO_ID)).toHaveLength(1)
  })

  it('rejects what the RPC rejects', () => {
    const database = createMockDatabase(null, USER)
    const invalidLabel = createIntent()
    invalidLabel.values.label = 'emoji 🎉'

    expect(() => database.applyTodoMutation(createIntent(), null)).toThrow(PostgrestMockError)
    expect(() => database.applyTodoMutation(invalidLabel, USER)).toThrow(/supported characters/)
    expect(() =>
      database.applyTodoMutation(
        { kind: 'update', mutationId: 'm-9', todoId: TODO_ID, values: { updatedAt: 1 } },
        OTHER,
      ),
    ).toThrow(/not found/)
  })

  it('persists to storage and resets to the seed', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    }

    createMockDatabase(storage, USER).applyTodoMutation(createIntent(), USER)
    const reloaded = createMockDatabase(storage, USER)
    expect(reloaded.selectTodos(USER).some((row) => row.id === TODO_ID)).toBe(true)

    reloaded.reset()
    expect(reloaded.selectTodos(USER).some((row) => row.id === TODO_ID)).toBe(false)
  })
})

describe('mock PostgREST queries', () => {
  const rows = [
    { id: 'a', week_number: 202601, deleted_at: null },
    { id: 'b', week_number: 202603, deleted_at: 5 },
    { id: 'c', week_number: null, deleted_at: null },
  ]

  it('filters, orders and pages', () => {
    const search = new URLSearchParams('deleted_at=is.null&order=id.desc&limit=1&offset=1')

    expect(queryRows(rows, search)).toEqual({ offset: 1, rows: [rows[0]], total: 2 })
    expect(queryRows(rows, new URLSearchParams('week_number=gte.202602')).rows).toEqual([rows[1]])
    expect(queryRows(rows, new URLSearchParams('id=in.(a,c)')).rows).toEqual([rows[0], rows[2]])
    expect(queryRows(rows, new URLSearchParams('deleted_at=not.is.null')).rows).toEqual([rows[1]])
  })

  it('fails loudly on syntax it does not implement', () => {
    expect(() => queryRows(rows, new URLSearchParams('id=like.a*'))).toThrow(UnsupportedQueryError)
    expect(() => queryRows(rows, new URLSearchParams('or=(id.eq.a)'))).toThrow(
      UnsupportedQueryError,
    )
  })
})
