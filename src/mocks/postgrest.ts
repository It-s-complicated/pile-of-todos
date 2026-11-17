/**
 * Just enough of PostgREST's query syntax for the reads the app makes:
 * `column=op.value` filters, `order`, `limit`, and `offset`.
 * Unsupported syntax throws so a new query shape fails loudly instead of
 * silently returning the wrong rows.
 */

type Row = Record<string, unknown>

export class UnsupportedQueryError extends Error {}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset'])

function parseScalar(raw: string): unknown {
  if (raw === 'null') return null
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  return raw.replace(/^"(.*)"$/, '$1')
}

function compare(left: unknown, right: unknown): number {
  if (left === right) return 0
  if (left === null || left === undefined) return 1
  if (right === null || right === undefined) return -1
  return left < right ? -1 : 1
}

/** SQL semantics: comparing against NULL is never true. */
function compareNonNull(value: unknown, raw: string, test: (difference: number) => boolean) {
  const operand = parseScalar(raw)
  return value != null && operand != null && test(compare(value, operand))
}

function matches(value: unknown, filter: string): boolean {
  const negated = filter.startsWith('not.')
  const expression = negated ? filter.slice(4) : filter
  const dot = expression.indexOf('.')
  const operator = expression.slice(0, dot)
  const raw = expression.slice(dot + 1)
  let result: boolean

  switch (operator) {
    case 'eq':
      result = value === parseScalar(raw) || String(value) === raw
      break
    case 'neq':
      result = value !== parseScalar(raw) && String(value) !== raw
      break
    case 'is':
      result = value === parseScalar(raw)
      break
    case 'gt':
      result = compareNonNull(value, raw, (difference) => difference > 0)
      break
    case 'gte':
      result = compareNonNull(value, raw, (difference) => difference >= 0)
      break
    case 'lt':
      result = compareNonNull(value, raw, (difference) => difference < 0)
      break
    case 'lte':
      result = compareNonNull(value, raw, (difference) => difference <= 0)
      break
    case 'in': {
      const options = raw
        .replace(/^\((.*)\)$/, '$1')
        .split(',')
        .map(parseScalar)
      result = options.includes(value) || options.map(String).includes(String(value))
      break
    }
    default:
      throw new UnsupportedQueryError(`Mock PostgREST does not support the "${operator}" filter`)
  }

  return negated ? !result : result
}

export function queryRows<T extends Row>(
  rows: readonly T[],
  search: URLSearchParams,
): { offset: number; rows: T[]; total: number } {
  let result = [...rows]

  for (const [column, filter] of search) {
    if (RESERVED_PARAMS.has(column)) continue
    if (column === 'or' || column === 'and') {
      throw new UnsupportedQueryError(`Mock PostgREST does not support "${column}" filters`)
    }
    result = result.filter((row) => matches(row[column], filter))
  }

  const order = search.get('order')
  if (order) {
    const sorts = order.split(',').map((part) => {
      const [column, direction] = part.split('.')
      return { column, sign: direction === 'desc' ? -1 : 1 }
    })
    result.sort((left, right) => {
      for (const { column, sign } of sorts) {
        const difference = compare(left[column], right[column])
        if (difference !== 0) return difference * sign
      }
      return 0
    })
  }

  const total = result.length
  const offset = Number(search.get('offset') ?? 0)
  const limit = search.has('limit') ? Number(search.get('limit')) : undefined

  return {
    offset,
    rows: result.slice(offset, limit === undefined ? undefined : offset + limit),
    total,
  }
}
