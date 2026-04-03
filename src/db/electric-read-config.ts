import { env } from '@/lib/env'

export function buildElectricReadShapeUrl(
  baseUrl: string,
  sourceId: string,
  secret: string,
): string {
  const url = new URL(baseUrl)

  url.searchParams.set('source_id', sourceId)
  url.searchParams.set('secret', secret)

  return url.toString()
}

export function getElectricReadShapeUrl(): string {
  return buildElectricReadShapeUrl(env.electricShapeUrl, env.electricSourceId, env.electricSecret)
}
