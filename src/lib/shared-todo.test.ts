import { assert, test } from 'vite-plus/test'

import { getSharedTodoLabel } from './shared-todo'

test('combines shared title, text, and URL without decoding them twice', () => {
  const query = Object.fromEntries(
    new URLSearchParams(
      'share_title=Read+this&share_text=Gr%C3%BC%C3%9Fe%20%F0%9F%91%8B&share_url=https%3A%2F%2Fexample.com%2Fa%253Fb%3Fx%3D1%26y%3D2',
    ),
  )
  assert.equal(
    getSharedTodoLabel(query),
    'Read this\n\nGrüße 👋\n\nhttps://example.com/a%3Fb?x=1&y=2',
  )
})

test('accepts Android text-only URLs and avoids duplicate titles and URLs', () => {
  const text = 'https://example.com/?q=a+b#section'
  assert.equal(getSharedTodoLabel({ share_text: text }), text)
  assert.equal(getSharedTodoLabel({ share_title: text, share_text: text, share_url: text }), text)
  assert.equal(getSharedTodoLabel({ share_text: `Read ${text}`, share_url: text }), `Read ${text}`)
})

test('keeps long and multiline text intact for review', () => {
  const text = `First line\n${'a'.repeat(600)}`
  assert.equal(getSharedTodoLabel({ share_text: text }), text)
})

test('ignores unrelated queries and empty shares and handles repeated fields', () => {
  assert.equal(getSharedTodoLabel({ title: 'Ordinary query', add: '1' }), null)
  assert.equal(getSharedTodoLabel({ share_text: '  ', share_url: null }), null)
  assert.equal(getSharedTodoLabel({ share_title: [' First ', 'Second'] }), 'First')
})
