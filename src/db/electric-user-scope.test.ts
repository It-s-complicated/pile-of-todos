import { assert, test } from 'vite-plus/test'

import type { ElectricUserScope } from '@/lib/supabase-config'

import { createElectricScopeParams } from './electric-user-scope.ts'

test('createElectricScopeParams reuses one scope read for matching where and params callbacks', async () => {
  let scopeReadCount = 0
  const firstScope: ElectricUserScope = {
    where: 'user_id = $1',
    params: {
      '1': 'user-a',
    },
  }

  const scopeParams = createElectricScopeParams(async () => {
    scopeReadCount += 1
    return firstScope
  })

  assert.equal(await scopeParams.where(), firstScope.where)
  assert.deepEqual(await scopeParams.params(), firstScope.params)
  assert.equal(scopeReadCount, 1)
})

test('createElectricScopeParams pairs params with the most recent where call', async () => {
  let scopeReadCount = 0
  const scopes: ElectricUserScope[] = [
    {
      where: 'user_id = $1',
      params: { '1': 'user-a' },
    },
    {
      where: 'user_id = $1',
      params: { '1': 'user-b' },
    },
  ]

  const scopeParams = createElectricScopeParams(async () => {
    const nextScope = scopes[scopeReadCount]
    scopeReadCount += 1

    if (!nextScope) {
      throw new Error('Expected another scope to be available for this test.')
    }

    return nextScope
  })

  await scopeParams.where()
  await scopeParams.where()
  assert.deepEqual(await scopeParams.params(), { '1': 'user-b' })
  assert.equal(scopeReadCount, 2)
})

test('createElectricScopeParams clears a failed where scope so the next request can recover', async () => {
  let scopeReadCount = 0

  const scopeParams = createElectricScopeParams(async () => {
    scopeReadCount += 1

    if (scopeReadCount === 1) {
      throw new Error('temporary auth lookup failure')
    }

    return {
      where: 'user_id = $1',
      params: { '1': 'user-recovered' },
    }
  })

  let failureMessage = ''

  try {
    await scopeParams.where()
  } catch (error) {
    failureMessage = error instanceof Error ? error.message : String(error)
  }

  assert.equal(failureMessage, 'temporary auth lookup failure')
  assert.equal(await scopeParams.where(), 'user_id = $1')
  assert.deepEqual(await scopeParams.params(), { '1': 'user-recovered' })
  assert.equal(scopeReadCount, 2)
})
