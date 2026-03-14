export type SyncTodo = {
  id: string
  label: string
  weekNumber: number | null
  done: boolean
  archived: boolean
  createdAt: number
  updatedAt: number
  deviceId: string | null
  deletedAt: number | null
  userId: string | null
}

export type RemoteTodoRow = {
  id: string
  label: string
  week_number: number | null
  done: boolean
  archived: boolean
  created_at: number
  updated_at: number
  device_id: string
  deleted_at: number | null
  user_id: string
}

export function shouldPushTodoForUser(
  todo: Pick<SyncTodo, 'userId'>,
  activeUserId: string | null,
): boolean {
  return activeUserId !== null && todo.userId === activeUserId
}

export function buildRemoteTodoRow(todo: SyncTodo, fallbackDeviceId: string): RemoteTodoRow {
  if (!todo.userId) {
    throw new Error(`Cannot build a remote todo row without an authenticated owner`)
  }

  return {
    id: todo.id,
    label: todo.label,
    week_number: todo.weekNumber,
    done: todo.done,
    archived: todo.archived,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    device_id: todo.deviceId || fallbackDeviceId,
    deleted_at: todo.deletedAt,
    user_id: todo.userId,
  }
}
