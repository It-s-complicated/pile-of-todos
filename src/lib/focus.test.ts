import { nextTick } from 'vue'
import { assert, test, vi } from 'vite-plus/test'

import { focusAfterUpdate } from './focus'

test('focusAfterUpdate resolves and focuses its target after Vue updates', async () => {
  const focus = vi.fn<() => void>()

  focusAfterUpdate(() => ({ focus }) as unknown as HTMLElement)

  assert.equal(focus.mock.calls.length, 0)
  await nextTick()
  assert.equal(focus.mock.calls.length, 1)
})
