import type { LocationQuery } from 'vue-router'

function firstValue(value: LocationQuery[string]): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

export function getSharedTodoLabel(query: LocationQuery): string | null {
  const title = firstValue(query.share_title)
  const text = firstValue(query.share_text)
  const url = firstValue(query.share_url)
  const parts = [...new Set([title, text].filter(Boolean))]

  // Android often includes the URL in text instead of the dedicated URL field.
  if (url && !parts.some((part) => part.includes(url))) parts.push(url)

  return parts.join('\n\n') || null
}
