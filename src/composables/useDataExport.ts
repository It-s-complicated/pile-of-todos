const PHASE_3_EXPORT_ERROR =
  'Import/export is disabled until the Phase 4 sync migration work is complete.'

export function useDataExport() {
  function exportTodos(): never {
    throw new Error(PHASE_3_EXPORT_ERROR)
  }

  async function importTodos(_file: File): Promise<{ success: false; message: string }> {
    return {
      success: false,
      message: 'Import is disabled until the Phase 4 sync migration work is complete.',
    }
  }

  return { exportTodos, importTodos }
}
