import { createClient, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { effectScope, nextTick, ref } from 'vue'
import { assert, expect, test, vi } from 'vite-plus/test'

import type { ConfirmedTodoRow } from '@/db/confirmed-todos'

const { fetchSnapshot } = vi.hoisted(() => ({ fetchSnapshot: vi.fn<typeof fetch>() }))
const accessState = ref<'signed-in' | 'signed-out'>('signed-in')
const userId = ref<string | null>('22222222-2222-4222-8222-222222222222')

vi.mock('@/lib/supabase', () => {
  const client = createClient('https://todos.example.com', 'test-anon-key', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: fetchSnapshot },
  })
  const createChannel = client.channel.bind(client)

  vi.spyOn(client, 'channel').mockImplementation((topic, options) => {
    const channel = createChannel(topic, options)
    vi.spyOn(channel, 'subscribe').mockImplementation((callback) => {
      callback?.(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)
      return channel
    })
    vi.spyOn(channel, 'unsubscribe').mockResolvedValue('ok')
    return channel
  })

  return { getSupabaseClient: () => client }
})

vi.mock('./useAuth', () => ({
  useAuth: () => ({ accessState, userId, isAuthReady: ref(true) }),
}))

vi.mock('./useTodoCreateQueueController', () => ({
  useTodoMutationQueueController: () => ({ pendingMutations: ref([]) }),
}))

const initialRow: ConfirmedTodoRow = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Confirmed todo',
  week_number: null,
  done: false,
  archived: false,
  created_at: 10,
  updated_at: 20,
  device_id: null,
  user_id: userId.value!,
  deleted_at: null,
}

test('real DB adapters preserve scoped live reads, refreshes, Realtime, and sync recovery', async () => {
  let rows = [initialRow]
  fetchSnapshot.mockImplementation(async () => {
    const range = rows.length === 0 ? '*/0' : `0-${rows.length - 1}/${rows.length}`
    return Response.json(rows, { headers: { 'content-range': range } })
  })

  const { useTodoReadModel } = await import('./useTodoReadModel')
  const { getConfirmedTodosCollection, refreshConfirmedTodos } =
    await import('@/db/confirmed-todos')
  const { getSupabaseClient } = await import('@/lib/supabase')
  const collection = getConfirmedTodosCollection()
  const scope = effectScope()
  const readModel = scope.run(() => useTodoReadModel())!
  const errorLog = vi.spyOn(console, 'error').mockImplementationOnce(() => {})

  try {
    await vi.waitFor(() => {
      assert.equal(readModel.isReady.value, true)
      assert.equal(readModel.todos.value[0]?.label, 'Confirmed todo')
    })

    const firstRequest = fetchSnapshot.mock.calls[0]?.[0]
    assert.ok(typeof firstRequest === 'string')
    const requestUrl = new URL(firstRequest)
    assert.equal(requestUrl.searchParams.get('user_id'), `eq.${initialRow.user_id}`)

    rows = [{ ...initialRow, label: 'Refreshed todo', updated_at: 30 }]
    await refreshConfirmedTodos()
    await vi.waitFor(() => assert.equal(readModel.todos.value[0]?.label, 'Refreshed todo'))

    const channel = getSupabaseClient().getChannels()[0]
    const updateListener = channel?.bindings.postgres_changes?.find(
      ({ filter }) => filter.event === 'UPDATE',
    )
    assert.ok(updateListener, 'the confirmed collection subscribes to Realtime updates')
    updateListener.callback(
      { new: { ...rows[0], label: 'Realtime todo', updated_at: 40 } },
      undefined,
      '',
    )
    await vi.waitFor(() => assert.equal(readModel.todos.value[0]?.label, 'Realtime todo'))

    fetchSnapshot.mockResolvedValueOnce(
      Response.json({ message: 'Read access denied' }, { status: 403 }),
    )
    await expect(refreshConfirmedTodos()).rejects.toThrow('Read access denied')
    assert.equal(collection.status, 'ready')
    assert.equal(readModel.isReady.value, true)
    assert.equal(readModel.todos.value[0]?.label, 'Realtime todo')
    assert.ok(collection.health.failureReason)

    rows = []
    await refreshConfirmedTodos()
    await vi.waitFor(() => assert.deepEqual(readModel.todos.value, []))
    assert.equal(collection.health.failureReason, null)
    assert.equal(readModel.isReady.value, true)

    userId.value = '33333333-3333-4333-8333-333333333333'
    rows = [{ ...initialRow, id: 'todo-b', user_id: userId.value, label: 'User B todo' }]
    await nextTick()
    await vi.waitFor(() => assert.equal(readModel.todos.value[0]?.label, 'User B todo'))
    const lastRequest = fetchSnapshot.mock.calls.at(-1)?.[0]
    assert.ok(typeof lastRequest === 'string')
    assert.equal(new URL(lastRequest).searchParams.get('user_id'), `eq.${userId.value}`)

    accessState.value = 'signed-out'
    userId.value = null
    await nextTick()
    assert.deepEqual(readModel.todos.value, [])
    assert.equal(readModel.isReady.value, true)
  } finally {
    errorLog.mockRestore()
    scope.stop()
    await collection.cleanup({ dependents: true })
  }
})
