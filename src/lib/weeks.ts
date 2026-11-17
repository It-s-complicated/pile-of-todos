/**
 * Year-aware ISO week helpers.
 *
 * A todo's `weekNumber` stores a week key in the form `YYYYWW` (e.g. `202646`),
 * so weeks keep sorting and comparing correctly across a year boundary.
 * Older rows stored only the ISO week (`1`–`53`); `normalizeWeekKey()` upgrades
 * those at read time using the todo's creation date.
 */

export type WeekKey = number

const DAY_MS = 86_400_000
const LEGACY_WEEK_LIMIT = 100

type IsoWeek = { week: number; year: number }

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day))
}

function isoWeekOfUtcDate(date: Date): IsoWeek {
  const thursday = new Date(date.getTime())
  // ISO weeks start on Monday; the week belongs to the year of its Thursday.
  const isoWeekday = thursday.getUTCDay() || 7
  thursday.setUTCDate(thursday.getUTCDate() + 4 - isoWeekday)
  const year = thursday.getUTCFullYear()
  const yearStart = utcDate(year, 0, 1)
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)

  return { week, year }
}

function localCalendarDate(date: Date): Date {
  return utcDate(date.getFullYear(), date.getMonth(), date.getDate())
}

export function toWeekKey(year: number, week: number): WeekKey {
  return year * 100 + week
}

export function weekKeyYear(key: WeekKey): number {
  return Math.floor(key / 100)
}

export function weekKeyWeek(key: WeekKey): number {
  return key % 100
}

export function weekKeyOfDate(date: Date): WeekKey {
  const { week, year } = isoWeekOfUtcDate(localCalendarDate(date))
  return toWeekKey(year, week)
}

export function getCurrentWeekKey(now: Date = new Date()): WeekKey {
  return weekKeyOfDate(now)
}

/** Monday of the given week, as a UTC midnight date. */
export function weekStart(key: WeekKey): Date {
  const year = weekKeyYear(key)
  const jan4 = utcDate(year, 0, 4)
  const jan4Weekday = jan4.getUTCDay() || 7
  const firstMonday = utcDate(year, 0, 4 - jan4Weekday + 1)

  return new Date(firstMonday.getTime() + (weekKeyWeek(key) - 1) * 7 * DAY_MS)
}

export function addWeeks(key: WeekKey, count: number): WeekKey {
  const start = weekStart(key)
  const shifted = new Date(start.getTime() + count * 7 * DAY_MS)
  const { week, year } = isoWeekOfUtcDate(shifted)
  return toWeekKey(year, week)
}

/** Whole weeks from `from` to `to` (positive when `to` is later). */
export function weeksBetween(from: WeekKey, to: WeekKey): number {
  return Math.round((weekStart(to).getTime() - weekStart(from).getTime()) / (7 * DAY_MS))
}

/**
 * Upgrades a legacy week number (no year) to a `YYYYWW` key. Legacy clients
 * only wrote `currentWeek + 0..3` without wrapping at year end, so the value
 * belongs to the ISO year the todo was created in, and anything past that
 * year's last week (e.g. `54`) carries over into the next year.
 * Keys that already carry a year pass through unchanged.
 */
export function normalizeWeekKey(value: number | null, createdAt: number): WeekKey | null {
  if (value === null || value >= LEGACY_WEEK_LIMIT || value < 1) {
    return value
  }

  const { year } = isoWeekOfUtcDate(localCalendarDate(new Date(createdAt)))
  return addWeeks(toWeekKey(year, 1), value - 1)
}

const monthDay = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayOnly = new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: 'UTC' })

/** e.g. "Nov 9 – 15" or "Dec 28 – Jan 3". */
export function formatWeekRange(key: WeekKey): string {
  const start = weekStart(key)
  const end = new Date(start.getTime() + 6 * DAY_MS)
  const endLabel =
    start.getUTCMonth() === end.getUTCMonth() ? dayOnly.format(end) : monthDay.format(end)

  return `${monthDay.format(start)} – ${endLabel}`
}

/** "Week 49", or "Week 2 · 2027" when the year differs from the current one. */
export function formatWeekNumber(key: WeekKey, currentWeek: WeekKey): string {
  const label = `Week ${weekKeyWeek(key)}`
  return weekKeyYear(key) === weekKeyYear(currentWeek) ? label : `${label} · ${weekKeyYear(key)}`
}

/** Friendly relative name: "This week", "Next week", "Last week", or "Week 49". */
export function formatRelativeWeek(key: WeekKey, currentWeek: WeekKey): string {
  const distance = weeksBetween(currentWeek, key)

  if (distance === 0) return 'This week'
  if (distance === 1) return 'Next week'
  if (distance === -1) return 'Last week'
  return formatWeekNumber(key, currentWeek)
}
