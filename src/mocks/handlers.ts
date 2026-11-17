import { http, HttpResponse, ws } from 'msw'

import { createSession, getUserIdFromRequest, mockUser } from './auth'
import { PostgrestMockError, type MockDatabase } from './database'
import { queryRows, UnsupportedQueryError } from './postgrest'

type PhoenixMessage = [
  joinRef: string | null,
  ref: string | null,
  topic: string,
  event: string,
  payload: Record<string, unknown>,
]

type PostgresChangeBinding = { event: string; schema: string; table: string; filter?: string }

function postgrestError(status: number, code: string, message: string) {
  return HttpResponse.json({ code, details: null, hint: null, message }, { status })
}

/**
 * Realtime speaks Phoenix channels (protocol 2.0.0: JSON arrays). The mock
 * only acknowledges joins and heartbeats so channels report SUBSCRIBED; the
 * app re-reads todos after every accepted write, so no change events are sent.
 */
function createRealtimeHandler(supabaseUrl: string) {
  const socketUrl = `${supabaseUrl.replace(/^http/, 'ws')}/realtime/v1/websocket`
  const realtime = ws.link(socketUrl)

  return realtime.addEventListener('connection', ({ client }) => {
    client.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return

      const [joinRef, ref, topic, name, payload] = JSON.parse(event.data) as PhoenixMessage
      const reply = (response: Record<string, unknown>) =>
        client.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]))

      if (name === 'phx_join') {
        const config = payload.config as { postgres_changes?: PostgresChangeBinding[] } | undefined
        // The client checks that the server echoes its bindings back with ids.
        const postgresChanges = (config?.postgres_changes ?? []).map((binding, index) => ({
          ...binding,
          id: index + 1,
        }))
        reply({ postgres_changes: postgresChanges })
        return
      }

      if (ref !== null) {
        reply({})
      }
    })
  })
}

export function createHandlers(supabaseUrl: string, database: MockDatabase) {
  const auth = `${supabaseUrl}/auth/v1`
  const rest = `${supabaseUrl}/rest/v1`

  return [
    http.get(`${auth}/user`, ({ request }) =>
      getUserIdFromRequest(request)
        ? HttpResponse.json(mockUser)
        : HttpResponse.json({ code: 401, msg: 'Invalid token' }, { status: 401 }),
    ),

    http.post(`${auth}/token`, () => HttpResponse.json(createSession())),

    http.post(`${auth}/logout`, () => new HttpResponse(null, { status: 204 })),

    http.get(`${rest}/todos`, ({ request }) => {
      try {
        const url = new URL(request.url)
        const rows = database.selectTodos(getUserIdFromRequest(request))
        const { offset, rows: page, total } = queryRows(rows, url.searchParams)
        const range = page.length > 0 ? `${offset}-${offset + page.length - 1}` : '*'

        return HttpResponse.json(page, { headers: { 'Content-Range': `${range}/${total}` } })
      } catch (error) {
        if (error instanceof UnsupportedQueryError) {
          return postgrestError(400, 'PGRST100', error.message)
        }
        throw error
      }
    }),

    http.post(`${rest}/rpc/apply_todo_mutation`, async ({ request }) => {
      const { intent } = (await request.json()) as { intent: Record<string, unknown> }

      try {
        return HttpResponse.json(database.applyTodoMutation(intent, getUserIdFromRequest(request)))
      } catch (error) {
        if (error instanceof PostgrestMockError) {
          return postgrestError(400, error.code, error.message)
        }
        throw error
      }
    }),

    createRealtimeHandler(supabaseUrl),
  ]
}
