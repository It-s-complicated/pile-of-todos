import type { ElectricUserScope } from '@/lib/supabase-config'

type ElectricScopeReader = () => Promise<ElectricUserScope>

type ElectricScopeParams = {
  where: () => Promise<string>
  params: () => Promise<Record<string, string>>
}

export function createElectricScopeParams(
  readCurrentScope: ElectricScopeReader,
): ElectricScopeParams {
  let pendingScopeForParams: Promise<ElectricUserScope> | null = null

  async function where() {
    const currentScopePromise = readCurrentScope()
    pendingScopeForParams = currentScopePromise

    try {
      return (await currentScopePromise).where
    } catch (error) {
      if (pendingScopeForParams === currentScopePromise) {
        pendingScopeForParams = null
      }

      throw error
    }
  }

  async function params() {
    const currentScopePromise = pendingScopeForParams ?? readCurrentScope()
    pendingScopeForParams = null

    return (await currentScopePromise).params
  }

  return { where, params }
}
