import * as v from 'valibot'

const mutationIdSchema = v.pipe(v.string(), v.minLength(1))
const todoIdSchema = v.pipe(v.string(), v.uuid())
const userIdSchema = v.pipe(v.string(), v.uuid())
const txidInputSchema = v.union([
  v.pipe(v.string(), v.regex(/^[1-9]\d*$/u, 'txid must be a positive integer string')),
  v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER)),
])

const todoClientMetadataSchema = v.strictObject({
  deviceId: v.optional(v.nullable(v.string())),
})

const todoCreateValuesSchema = v.strictObject({
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
  weekNumber: v.nullable(v.number()),
  done: v.boolean(),
  archived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.nullable(v.number()),
})

const todoUpdateValuesSchema = v.strictObject({
  label: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(500))),
  weekNumber: v.optional(v.nullable(v.number())),
  done: v.optional(v.boolean()),
  archived: v.optional(v.boolean()),
  deletedAt: v.optional(v.nullable(v.number())),
  updatedAt: v.number(),
})

const todoDeleteValuesSchema = v.strictObject({
  deletedAt: v.number(),
  updatedAt: v.number(),
})

export const todoCreateIntentSchema = v.strictObject({
  kind: v.literal('create'),
  mutationId: mutationIdSchema,
  todoId: todoIdSchema,
  user_id: userIdSchema,
  client: v.optional(todoClientMetadataSchema),
  values: todoCreateValuesSchema,
})

export const todoUpdateIntentSchema = v.strictObject({
  kind: v.literal('update'),
  mutationId: mutationIdSchema,
  todoId: todoIdSchema,
  user_id: userIdSchema,
  client: v.optional(todoClientMetadataSchema),
  values: todoUpdateValuesSchema,
})

export const todoDeleteIntentSchema = v.strictObject({
  kind: v.literal('delete'),
  mutationId: mutationIdSchema,
  todoId: todoIdSchema,
  user_id: userIdSchema,
  client: v.optional(todoClientMetadataSchema),
  values: todoDeleteValuesSchema,
})

export const todoMutationIntentSchema = v.variant('kind', [
  todoCreateIntentSchema,
  todoUpdateIntentSchema,
  todoDeleteIntentSchema,
])

export const todoMutationResponseSchema = v.strictObject({
  mutationId: mutationIdSchema,
  todoId: todoIdSchema,
  txid: txidInputSchema,
})

export const TODO_MUTATION_STATUSES = [
  'queued',
  'sending',
  'accepted-awaiting-sync',
  'confirmed',
  'retryable-error',
  'rejected',
] as const

export const todoMutationStatusSchema = v.picklist(TODO_MUTATION_STATUSES)

export const TODO_MUTATION_IDEMPOTENCY = {
  mutationIdSurvivesRetries: true,
  createUsesStableTodoId: true,
  duplicateEffectKey: 'todoId+mutationId',
  enforcedBy: 'supabase-db-layer',
  acceptedWriteRequiresTxid: true,
  txidRepresents: 'postgres-acceptance',
  confirmationSource: 'electric-sync',
  supportsUserPartitionedPendingWork: true,
} as const

export type TodoCreateIntent = v.InferOutput<typeof todoCreateIntentSchema>
export type TodoUpdateIntent = v.InferOutput<typeof todoUpdateIntentSchema>
export type TodoDeleteIntent = v.InferOutput<typeof todoDeleteIntentSchema>
export type TodoMutationIntent = v.InferOutput<typeof todoMutationIntentSchema>
export type TodoMutationResponse = {
  mutationId: string
  todoId: string
  txid: string
}
export type TodoMutationStatus = v.InferOutput<typeof todoMutationStatusSchema>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function failWithIssues(label: string, issues: readonly v.BaseIssue<unknown>[]): never {
  const message = issues.map((issue) => issue.message).join('; ')
  throw new Error(`${label} is invalid: ${message}`)
}

function parseContract<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  input: unknown,
  label: string,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, input)

  if (!result.success) {
    failWithIssues(label, result.issues)
  }

  return result.output
}

function assertNoUnknownKeys(label: string, input: unknown, allowedKeys: readonly string[]) {
  if (!isRecord(input)) {
    return
  }

  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.includes(key))

  if (unknownKeys.length > 0) {
    throw new Error(`${label} has unknown keys: ${unknownKeys.join(', ')}`)
  }
}

function hasMutatedUpdateField(values: TodoUpdateIntent['values']) {
  return [values.label, values.weekNumber, values.done, values.archived, values.deletedAt].some(
    (value) => value !== undefined,
  )
}

function assertValidUpdateDeleteSemantics(values: TodoUpdateIntent['values']) {
  if (values.deletedAt === undefined || values.deletedAt === null) {
    return
  }

  throw new Error(
    'Todo mutation intent is invalid: delete intents must carry tombstones and update intents may only clear deletedAt back to null',
  )
}

function assertValidCreateDeleteSemantics(values: TodoCreateIntent['values']) {
  if (values.deletedAt === null) {
    return
  }

  throw new Error('Todo mutation intent is invalid: create intents may only use deletedAt null')
}

function normalizeTxid(txid: string | number): string {
  return typeof txid === 'string' ? txid : String(txid)
}

export function parseTodoMutationIntent(input: unknown): TodoMutationIntent {
  const intent = parseContract(todoMutationIntentSchema, input, 'Todo mutation intent')

  if (intent.kind === 'create') {
    assertValidCreateDeleteSemantics(intent.values)
    return intent
  }

  if (intent.kind !== 'update') {
    return intent
  }

  if (!hasMutatedUpdateField(intent.values)) {
    throw new Error(
      'Todo mutation intent is invalid: update values must include at least one mutated field',
    )
  }

  assertValidUpdateDeleteSemantics(intent.values)

  return intent
}

export function parseTodoMutationResponse(input: unknown): TodoMutationResponse {
  assertNoUnknownKeys('Todo mutation response', input, ['mutationId', 'todoId', 'txid'])
  const response = parseContract(todoMutationResponseSchema, input, 'Todo mutation response')

  return {
    mutationId: response.mutationId,
    todoId: response.todoId,
    txid: normalizeTxid(response.txid),
  }
}

export function parseTodoMutationStatus(input: unknown): TodoMutationStatus {
  return parseContract(todoMutationStatusSchema, input, 'Todo mutation status')
}
