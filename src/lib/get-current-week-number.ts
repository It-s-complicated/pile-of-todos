export function getCurrentWeekNumber(): number {
  const weekOfYear = Temporal.Now.plainDateISO().weekOfYear
  if (!weekOfYear) {
    throw new Error('Temporal did not return a week number for the current date.')
  }
  return weekOfYear
}
