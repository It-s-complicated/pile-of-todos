export type ElectricUserScope = {
  where: string
  params: Record<string, string>
}

export function getElectricUserScope(userId: string | null): ElectricUserScope {
  if (!userId) {
    return {
      where: '1 = 0',
      params: {},
    }
  }

  return {
    where: 'user_id = $1',
    params: {
      '1': userId,
    },
  }
}
