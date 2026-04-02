import { assert, test } from 'vite-plus/test'

test('useDataExport is disabled during Phase 3 to avoid bypassing the ledger-backed sync flow', async () => {
  const { useDataExport } = await import('./useDataExport')
  const { exportTodos, importTodos } = useDataExport()

  assert.throws(() => exportTodos(), /disabled|phase 4|phase four/i)

  const result = await importTodos(new File(['{}'], 'todos.json', { type: 'application/json' }))

  assert.deepEqual(result, {
    success: false,
    message: 'Import is disabled until the Phase 4 sync migration work is complete.',
  })
})
