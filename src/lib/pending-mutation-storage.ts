import type { Todo } from '@/db/collections'

import type {
  TodoMutationIntent,
  TodoMutationResponse,
  TodoMutationStatus,
} from './todo-mutation-contract'
import { parseTodoMutationIntent, parseTodoMutationResponse } from './todo-mutation-contract'

export const GUEST_PENDING_MUTATION_PARTITION = 'guest-migration'
const STORAGE_KEY = 'ai-todo-app-pending-mutations'

export const ACTIVE_PENDING_MUTATION_STATUSES = [
  'queued',
  'sending',
  'accepted-awaiting-sync',
  'retryable-error',
] as const

export type PendingMutationQuarantineReason =
  | 'confirmation-proof-failed'
  | 'txid-confirmation-lost-after-reset'
  | 'user-switched'

export type PendingMutationLocalStatus = TodoMutationStatus | 'quarantined' | 'invariant-violation'

export type PendingMutationEntry = {
  mutationId: string
  partitionKey: string
  kind: TodoMutationIntent['kind']
  todoId: string
  status: PendingMutationLocalStatus
  createdAt: number
  updatedAt: number
  optimisticTodo: Todo | null
  intent: TodoMutationIntent
  accepted?: TodoMutationResponse
  errorMessage?: string
  quarantine?: {
    reason: PendingMutationQuarantineReason
    at: number
  }
}

export type PendingMutationReference = Pick<PendingMutationEntry, 'partitionKey' | 'mutationId'>

type PendingMutationStorageOptions = {
  storage?: Storage | null
}

type QuarantinePartitionOptions = {
  partitionKey: string
  now: number
  reason: PendingMutationQuarantineReason
}

type StoredPendingMutationEntry = Omit<PendingMutationEntry, 'intent' | 'accepted'> & {
  intent: unknown
  accepted?: unknown
}

function getBrowserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPendingMutationStatus(value: unknown): value is PendingMutationLocalStatus {
  return [
    'queued',
    'sending',
    'accepted-awaiting-sync',
    'confirmed',
    'retryable-error',
    'rejected',
    'quarantined',
    'invariant-violation',
  ].includes(String(value))
}

function isTodo(value: unknown): value is Todo {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.id === 'string' && typeof value.label === 'string'
}

function parseStoredEntry(input: StoredPendingMutationEntry): PendingMutationEntry {
  if (!isPendingMutationStatus(input.status)) {
    throw new Error(`Pending mutation entry ${input.mutationId} has an invalid status`)
  }

  if (input.optimisticTodo !== null && !isTodo(input.optimisticTodo)) {
    throw new Error(`Pending mutation entry ${input.mutationId} has an invalid optimistic todo`)
  }

  return {
    mutationId: input.mutationId,
    partitionKey: input.partitionKey,
    kind: input.kind,
    todoId: input.todoId,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    optimisticTodo: input.optimisticTodo,
    intent: parseTodoMutationIntent(input.intent),
    accepted: input.accepted === undefined ? undefined : parseTodoMutationResponse(input.accepted),
    errorMessage: input.errorMessage,
    quarantine: input.quarantine,
  }
}

function parseStoredEntries(input: unknown): PendingMutationEntry[] {
  if (input === null || input === undefined || input === '') {
    return []
  }

  if (typeof input !== 'string') {
    throw new Error('Pending mutation storage is invalid: expected a serialized string')
  }

  const parsed = JSON.parse(input) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Pending mutation storage is invalid: expected an array')
  }

  return parsed.map((entry) => parseStoredEntry(entry as StoredPendingMutationEntry))
}

function sortEntries(entries: PendingMutationEntry[]) {
  return [...entries].sort((left, right) => left.createdAt - right.createdAt)
}

function writeEntries(storage: Storage | null, entries: PendingMutationEntry[]) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function isSamePendingMutation(
  left: PendingMutationReference,
  right: PendingMutationReference,
): boolean {
  return left.partitionKey === right.partitionKey && left.mutationId === right.mutationId
}

export function getPendingMutationPartitionKey(userId: string | null) {
  return userId ? `user:${userId}` : GUEST_PENDING_MUTATION_PARTITION
}

export function isActivePendingMutationStatus(status: PendingMutationLocalStatus): boolean {
  return ACTIVE_PENDING_MUTATION_STATUSES.includes(
    status as (typeof ACTIVE_PENDING_MUTATION_STATUSES)[number],
  )
}

export function createPendingMutationStorage(options: PendingMutationStorageOptions = {}) {
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage

  function readAll() {
    return sortEntries(parseStoredEntries(storage?.getItem(STORAGE_KEY) ?? null))
  }

  function commit(entries: PendingMutationEntry[]) {
    writeEntries(storage, sortEntries(entries))
  }

  function upsert(entry: PendingMutationEntry) {
    const entries = readAll()
    const nextEntries = entries.filter((candidate) => !isSamePendingMutation(candidate, entry))

    nextEntries.push({
      ...entry,
      intent: parseTodoMutationIntent(entry.intent),
      accepted: entry.accepted ? parseTodoMutationResponse(entry.accepted) : undefined,
    })
    commit(nextEntries)
  }

  function updateEntry(
    partitionKey: string,
    mutationId: string,
    updater: (entry: PendingMutationEntry) => PendingMutationEntry,
  ) {
    const entries = readAll()
    const nextEntries = entries.map((entry) => {
      if (entry.partitionKey !== partitionKey || entry.mutationId !== mutationId) {
        return entry
      }

      return updater(entry)
    })

    commit(nextEntries)
  }

  return {
    get(reference: PendingMutationReference) {
      return readAll().find((entry) => isSamePendingMutation(entry, reference)) ?? null
    },
    list(partitionKey: string) {
      return readAll().filter((entry) => entry.partitionKey === partitionKey)
    },
    listActive(partitionKey: string) {
      return readAll().filter(
        (entry) =>
          entry.partitionKey === partitionKey && isActivePendingMutationStatus(entry.status),
      )
    },
    remove(partitionKey: string, mutationId: string) {
      commit(
        readAll().filter(
          (entry) => !(entry.partitionKey === partitionKey && entry.mutationId === mutationId),
        ),
      )
    },
    save(entry: PendingMutationEntry) {
      upsert(entry)
    },
    update(
      partitionKey: string,
      mutationId: string,
      updater: (entry: PendingMutationEntry) => PendingMutationEntry,
    ) {
      updateEntry(partitionKey, mutationId, updater)
    },
    quarantinePartition({ partitionKey, now, reason }: QuarantinePartitionOptions) {
      const entries = readAll().map((entry) => {
        if (entry.partitionKey !== partitionKey || !isActivePendingMutationStatus(entry.status)) {
          return entry
        }

        return {
          ...entry,
          status: 'quarantined' as const,
          updatedAt: now,
          quarantine: {
            reason,
            at: now,
          },
        }
      })

      commit(entries)
    },
  }
}
