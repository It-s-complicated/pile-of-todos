import { createRenderer, defineComponent, nextTick, ref } from 'vue'
import { afterEach, assert, beforeEach, test, vi } from 'vite-plus/test'

import type { Todo } from '@/db/collections'
import { useTodoFavicon } from './useTodoFavicon'

let weekNumber = 14
vi.mock('@/lib/get-current-week-number', () => ({
  getCurrentWeekNumber: () => weekNumber,
}))

const renderer = createRenderer<object, object>({
  patchProp: () => {},
  insert: () => {},
  remove: () => {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText: () => {},
  setElementText: () => {},
  parentNode: () => null,
  nextSibling: () => null,
})
const todos = ref<Todo[]>([])
let href = '/favicon.svg'
let unmount: (() => void) | undefined
let browserWindow: EventTarget
let refreshInterval: (() => void) | undefined
const clearInterval = vi.fn<(id: number | undefined) => void>()

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-a',
    label: 'A task',
    weekNumber: 14,
    done: false,
    archived: false,
    deletedAt: null,
    createdAt: 0,
    updatedAt: 0,
    deviceId: null,
    userId: 'user-a',
    ...overrides,
  }
}

function mountFavicon(): void {
  const app = renderer.createApp(
    defineComponent({
      setup() {
        useTodoFavicon(todos)
        return () => null
      },
    }),
  )
  app.mount({})
  unmount = () => app.unmount()
}

function faviconSvg(): string {
  assert.ok(href.startsWith('data:image/svg+xml,'))
  return decodeURIComponent(href.slice('data:image/svg+xml,'.length))
}

beforeEach(() => {
  todos.value = []
  weekNumber = 14
  href = '/favicon.svg'
  refreshInterval = undefined
  clearInterval.mockReset()
  browserWindow = new EventTarget()
  vi.stubGlobal(
    'window',
    Object.assign(browserWindow, {
      setInterval: (callback: () => void) => {
        refreshInterval = callback
        return 1
      },
      clearInterval,
    }),
  )
  vi.stubGlobal('document', {
    querySelector: () => ({
      getAttribute: () => href,
      setAttribute: (_name: string, value: string) => {
        href = value
      },
    }),
  })
})

afterEach(() => {
  unmount?.()
  unmount = undefined
  vi.unstubAllGlobals()
})

test('favicon counts only unfinished, active todos in the current week', () => {
  todos.value = [
    todo(),
    todo({ done: true }),
    todo({ archived: true }),
    todo({ deletedAt: 1 }),
    todo({ weekNumber: null }),
    todo({ weekNumber: 13 }),
    todo({ weekNumber: 15 }),
  ]
  mountFavicon()

  assert.match(faviconSvg(), />1<\/text>/)
})

test('favicon updates on edits and restores the original when the count becomes zero', async () => {
  mountFavicon()
  assert.equal(href, '/favicon.svg')

  todos.value = [todo(), todo({ id: 'todo-b' })]
  await nextTick()
  assert.match(faviconSvg(), />2<\/text>/)

  todos.value = todos.value.map((item) => ({ ...item, done: true }))
  await nextTick()
  assert.equal(href, '/favicon.svg')

  todos.value = [todo()]
  await nextTick()
  todos.value = []
  await nextTick()
  assert.equal(href, '/favicon.svg')
})

test('favicon refreshes the week while open and when returning to the tab', async () => {
  todos.value = [todo(), todo({ weekNumber: 15 }), todo({ weekNumber: 15 })]
  mountFavicon()
  assert.match(faviconSvg(), />1<\/text>/)

  weekNumber = 15
  refreshInterval?.()
  await nextTick()
  assert.match(faviconSvg(), />2<\/text>/)

  weekNumber = 16
  browserWindow.dispatchEvent(new Event('focus'))
  await nextTick()
  assert.equal(href, '/favicon.svg')
})

test('favicon shows the exact multi-digit count and cleans up on unmount', async () => {
  todos.value = Array.from({ length: 123 }, (_, index) => todo({ id: `todo-${index}` }))
  mountFavicon()
  assert.match(faviconSvg(), />123<\/text>/)

  unmount?.()
  unmount = undefined
  assert.equal(href, '/favicon.svg')
  assert.deepEqual(clearInterval.mock.calls, [[1]])

  todos.value = [todo()]
  weekNumber = 15
  browserWindow.dispatchEvent(new Event('focus'))
  await nextTick()
  assert.equal(href, '/favicon.svg')
})
