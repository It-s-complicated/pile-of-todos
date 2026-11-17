import { assert, test } from 'vite-plus/test'

import {
  addWeeks,
  formatRelativeWeek,
  formatWeekRange,
  normalizeWeekKey,
  weekKeyOfDate,
  weeksBetween,
  weekStart,
} from './weeks'

test('weekKeyOfDate uses ISO week years', () => {
  assert.equal(weekKeyOfDate(new Date(2026, 10, 13)), 202646)
  // Jan 1 2027 is a Friday, so it still belongs to 2026's last ISO week.
  assert.equal(weekKeyOfDate(new Date(2027, 0, 1)), 202653)
  assert.equal(weekKeyOfDate(new Date(2027, 0, 4)), 202701)
  // Dec 29 2025 (Monday) is ISO week 1 of 2026.
  assert.equal(weekKeyOfDate(new Date(2025, 11, 29)), 202601)
})

test('weekStart returns the Monday of the week', () => {
  assert.equal(weekStart(202646).toISOString().slice(0, 10), '2026-11-09')
  assert.equal(weekStart(202701).toISOString().slice(0, 10), '2027-01-04')
})

test('addWeeks and weeksBetween cross year boundaries', () => {
  assert.equal(addWeeks(202652, 1), 202653)
  assert.equal(addWeeks(202653, 1), 202701)
  assert.equal(addWeeks(202701, -1), 202653)
  assert.equal(weeksBetween(202651, 202702), 4)
  assert.equal(weeksBetween(202702, 202651), -4)
})

test('normalizeWeekKey upgrades legacy week numbers', () => {
  const nov2026 = new Date(2026, 10, 13).getTime()
  const mar2026 = new Date(2026, 2, 2).getTime()

  assert.equal(normalizeWeekKey(null, nov2026), null)
  assert.equal(normalizeWeekKey(202646, nov2026), 202646)
  assert.equal(normalizeWeekKey(46, nov2026), 202646)
  assert.equal(normalizeWeekKey(12, nov2026), 202612)
  // Created in March, later moved to week 47 of the same year.
  assert.equal(normalizeWeekKey(47, mar2026), 202647)
  // Legacy clients wrote `week + 3` without wrapping: 2026 has 53 weeks.
  assert.equal(normalizeWeekKey(54, nov2026), 202701)
})

test('formatters produce short human labels', () => {
  assert.equal(formatWeekRange(202646), 'Nov 9 – 15')
  assert.equal(formatWeekRange(202653), 'Dec 28 – Jan 3')
  assert.equal(formatRelativeWeek(202646, 202646), 'This week')
  assert.equal(formatRelativeWeek(202647, 202646), 'Next week')
  assert.equal(formatRelativeWeek(202645, 202646), 'Last week')
  assert.equal(formatRelativeWeek(202650, 202646), 'Week 50')
  assert.equal(formatRelativeWeek(202702, 202646), 'Week 2 · 2027')
})
