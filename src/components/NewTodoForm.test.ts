// @vitest-environment happy-dom
import { createApp, nextTick, ref } from 'vue'
import type { App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, assert, beforeEach, test, vi } from 'vite-plus/test'

import NewTodoForm from './NewTodoForm.vue'

const addTodo = vi.fn<(label: string, weekNumber: number | null) => Promise<string>>()
const canCreateTodos = ref(true)
const createTodoDisabledReason = ref<string | null>(null)
let app: App | undefined

vi.mock('@/composables/useTodos', () => ({
  useTodos: () => ({ addTodo, canCreateTodos, createTodoDisabledReason }),
}))
vi.mock('@/lib/get-current-week-number', () => ({ getCurrentWeekNumber: () => 14 }))

async function mountForm(path = '/backlog') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/backlog', '/current', '/future'].map((path) => ({
      path,
      component: { template: '<div />' },
    })),
  })
  await router.push(path)
  await router.isReady()
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp(NewTodoForm).use(router)
  app.mount(root)
  await vi.waitFor(() => assert.equal(router.currentRoute.value.query.share_text, undefined))
  await nextTick()
  return router
}

function field(): HTMLInputElement | HTMLTextAreaElement {
  return document.querySelector('textarea, input')!
}

async function typeLabel(label: string) {
  field().value = label
  field().dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

async function submit() {
  document
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  await nextTick()
}

beforeEach(() => {
  window.sessionStorage.clear()
  canCreateTodos.value = true
  createTodoDisabledReason.value = null
  addTodo.mockReset()
  addTodo.mockResolvedValue('todo-shared')
})

afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

test('receives an editable draft, removes only share parameters, and queues a task only on submit', async () => {
  const router = await mountForm(
    '/backlog?share_title=Read&share_text=https%3A%2F%2Fexample.com%2F&keep=1#keep-fragment',
  )
  assert.equal(field().tagName, 'TEXTAREA')
  assert.equal(field().value, 'Read\n\nhttps://example.com/')
  assert.equal(document.activeElement, field())
  assert.deepEqual(router.currentRoute.value.query, { keep: '1' })
  assert.equal(router.currentRoute.value.hash, '#keep-fragment')
  assert.equal(addTodo.mock.calls.length, 0)

  await typeLabel('Read https://example.com/?q=Grüße 👋')
  await submit()
  assert.deepEqual(addTodo.mock.calls, [['Read https://example.com/?q=Grüße 👋', null]])
  assert.equal(field().value, '')

  app!.unmount()
  document.body.innerHTML = ''
  await mountForm()
  assert.equal(field().value, '')
})

test('preserves shared text, edits, and scheduling through the sign-in redirect', async () => {
  canCreateTodos.value = false
  createTodoDisabledReason.value = 'Sign in to create todos.'
  await mountForm('/backlog?share_text=Original')
  await typeLabel('Edited before signing in')
  const select = document.querySelector('select')!
  select.value = '15'
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  assert.match(document.body.textContent ?? '', /Sign in to create todos/)
  await submit()
  assert.equal(addTodo.mock.calls.length, 0)

  app!.unmount()
  document.body.innerHTML = ''
  canCreateTodos.value = true
  createTodoDisabledReason.value = null
  await mountForm('/current')
  assert.equal(field().value, 'Edited before signing in')
  assert.equal(document.querySelector('select')!.value, '15')
  await submit()
  assert.deepEqual(addTodo.mock.calls, [['Edited before signing in', 15]])
})

test('a new share replaces the existing form contents', async () => {
  const router = await mountForm()
  await typeLabel('An ordinary draft')
  await router.push('/backlog?share_text=First')
  await vi.waitFor(() => assert.equal(router.currentRoute.value.query.share_text, undefined))
  assert.equal(field().value, 'First')
  await typeLabel('Edited first')
  await router.push('/backlog?share_text=Second')
  await vi.waitFor(() => assert.equal(router.currentRoute.value.query.share_text, undefined))
  assert.equal(field().value, 'Second')
  await submit()
  assert.deepEqual(addTodo.mock.calls, [['Second', null]])
  assert.equal(field().value, '')
})

test('ordinary drafts persist and successful saves reset the stored form', async () => {
  await mountForm()
  await typeLabel('An ordinary draft')
  app!.unmount()
  document.body.innerHTML = ''

  await mountForm()
  assert.equal(field().value, 'An ordinary draft')
  await submit()
  assert.deepEqual(addTodo.mock.calls, [['An ordinary draft', 14]])
  assert.equal(field().value, '')

  app!.unmount()
  document.body.innerHTML = ''
  await mountForm()
  assert.equal(field().value, '')
})

test('preserves long shares for editing and retains the draft when saving fails', async () => {
  await mountForm(`/backlog?share_text=${'a'.repeat(501)}`)
  assert.equal(field().value.length, 501)
  await submit()
  assert.equal(addTodo.mock.calls.length, 0)
  assert.match(document.body.textContent ?? '', /at most 500 characters/)
  await typeLabel('Short enough')
  addTodo.mockRejectedValueOnce(new Error('Storage is full'))
  await submit()
  assert.match(document.body.textContent ?? '', /Storage is full/)
  assert.equal(field().value, 'Short enough')

  app!.unmount()
  document.body.innerHTML = ''
  await mountForm()
  assert.equal(field().value, 'Short enough')
})

test('Enter confirms composing text without submitting, then submits the completed text', async () => {
  await mountForm()
  await typeLabel('Buy ')
  field().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  field().value = 'Buy 牛乳'
  field().dispatchEvent(new Event('input', { bubbles: true }))

  const composingEnter = new KeyboardEvent('keydown', {
    key: 'Enter',
    isComposing: true,
    bubbles: true,
    cancelable: true,
  })
  field().dispatchEvent(composingEnter)
  await nextTick()
  assert.equal(composingEnter.defaultPrevented, false)
  assert.equal(addTodo.mock.calls.length, 0)
  assert.equal(field().value, 'Buy 牛乳')

  field().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  await nextTick()
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  field().dispatchEvent(enter)
  await nextTick()
  assert.equal(enter.defaultPrevented, true)
  assert.deepEqual(addTodo.mock.calls, [['Buy 牛乳', 14]])
})

test('Shift+Enter remains available for multiline input', async () => {
  await mountForm()
  await typeLabel('A multiline task')
  const enter = new KeyboardEvent('keydown', {
    key: 'Enter',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  })
  field().dispatchEvent(enter)
  await nextTick()
  assert.equal(enter.defaultPrevented, false)
  assert.equal(addTodo.mock.calls.length, 0)
})
