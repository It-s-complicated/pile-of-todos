import { assert, test, vi } from 'vite-plus/test'

vi.mock('@/lib/env', () => ({
  env: {
    electricShapeUrl: 'https://api.electric-sql.cloud/v1/shape',
    electricSourceId: 'svc-rude-peacock-bxymgk1c1m',
    electricSecret: 'secret-token',
  },
}))

import { getElectricReadShapeUrl } from './electric-read-config.ts'

test('getElectricReadShapeUrl appends the Electric Cloud credentials', () => {
  const url = new URL(getElectricReadShapeUrl())

  assert.equal(url.origin + url.pathname, 'https://api.electric-sql.cloud/v1/shape')
  assert.equal(url.searchParams.get('source_id'), 'svc-rude-peacock-bxymgk1c1m')
  assert.equal(url.searchParams.get('secret'), 'secret-token')
})
