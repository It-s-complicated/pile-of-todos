import { assert, test, vi } from 'vite-plus/test'

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({}),
}))

test('mapConfirmedTodoRow maps nullable PostgREST columns to the Todo domain', async () => {
  const { mapConfirmedTodoRow } = await import('./confirmed-todos')

  assert.deepEqual(
    mapConfirmedTodoRow({
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Mapped todo',
      week_number: null,
      done: false,
      archived: false,
      created_at: 10,
      updated_at: 20,
      device_id: null,
      user_id: '22222222-2222-4222-8222-222222222222',
      deleted_at: null,
    }),
    {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'Mapped todo',
      weekNumber: null,
      done: false,
      archived: false,
      createdAt: 10,
      updatedAt: 20,
      deviceId: null,
      userId: '22222222-2222-4222-8222-222222222222',
      deletedAt: null,
    },
  )
})

test('refreshConfirmedTodos rejects when no confirmed query is active', async () => {
  const { refreshConfirmedTodos } = await import('./confirmed-todos')

  try {
    await refreshConfirmedTodos()
    assert.fail('Expected refreshConfirmedTodos to reject')
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), /snapshot is not active/)
  }
})
