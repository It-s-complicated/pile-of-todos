import type { Todo } from '../types/todo'

export interface CloudSyncAdapter {
  uploadTodos: (todos: Todo[]) => Promise<void>
  downloadTodos: () => Promise<Todo[]>
}

export function useCloudSync() {
  let adapter: CloudSyncAdapter | null = null

  function setAdapter(newAdapter: CloudSyncAdapter) {
    adapter = newAdapter
  }

  async function sync(todos: Todo[]): Promise<void> {
    if (adapter) {
      await adapter.uploadTodos(todos)
    }
  }

  return { setAdapter, sync }
}
