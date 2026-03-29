import { ref } from 'vue'

import type { Todo } from '@/db/collections'

const OUTBOX_STORAGE_KEY = 'ai-todo-app-sync-outbox-v1'

export type TodoOutboxOperation = {
  attempts: number
  createdAt: number
  entityId: string
  nextRetryAt: number
  opId: string
  payload: Todo
  userId: string
}

const outboxRevision = ref(0)

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function readRawOutbox(): TodoOutboxOperation[] {
  if (!isBrowser()) {
    return []
  }

  const serialized = localStorage.getItem(OUTBOX_STORAGE_KEY)

  if (!serialized) {
    return []
  }

  const parsed = JSON.parse(serialized) as TodoOutboxOperation[]
  return Array.isArray(parsed) ? parsed : []
}

function writeRawOutbox(nextOutbox: TodoOutboxOperation[]) {
  if (!isBrowser()) {
    return
  }

  if (nextOutbox.length === 0) {
    localStorage.removeItem(OUTBOX_STORAGE_KEY)
  } else {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(nextOutbox))
  }

  outboxRevision.value += 1
}

export function getOutboxRevision() {
  return outboxRevision
}

export function listOutboxOperations() {
  return readRawOutbox()
}

export function getPendingOutboxOperations(activeUserId: string, now = Date.now()) {
  return readRawOutbox().filter((operation) => {
    if (operation.userId !== activeUserId) {
      return false
    }

    return operation.nextRetryAt <= now
  })
}

export function getPendingEntityIds(activeUserId: string): string[] {
  return readRawOutbox()
    .filter((operation) => operation.userId === activeUserId)
    .map((operation) => operation.entityId)
}

export function enqueueTodoUpsert(todo: Todo, activeUserId: string) {
  const existing = readRawOutbox()
  const compacted = existing.filter(
    (operation) => !(operation.userId === activeUserId && operation.entityId === todo.id),
  )

  compacted.push({
    attempts: 0,
    createdAt: Date.now(),
    entityId: todo.id,
    nextRetryAt: 0,
    opId: crypto.randomUUID(),
    payload: todo,
    userId: activeUserId,
  })

  writeRawOutbox(compacted)
}

export function ackOutboxOperation(opId: string) {
  const nextOutbox = readRawOutbox().filter((operation) => operation.opId !== opId)
  writeRawOutbox(nextOutbox)
}

export function failOutboxOperation(opId: string, attempts: number, retryAfterMs: number) {
  const nextOutbox = readRawOutbox().map((operation) => {
    if (operation.opId !== opId) {
      return operation
    }

    return {
      ...operation,
      attempts,
      nextRetryAt: Date.now() + retryAfterMs,
    }
  })

  writeRawOutbox(nextOutbox)
}
