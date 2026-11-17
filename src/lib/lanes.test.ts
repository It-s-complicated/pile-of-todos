import { assert, test } from 'vite-plus/test'

import type { Todo } from '@/db/collections'

import { filterLane, getQuickMove, groupByWeek } from './lanes'

const CURRENT = 202646

function todo(overrides: Partial<Todo> & Pick<Todo, 'id'>): Todo {
  return {
    label: overrides.id,
    weekNumber: null,
    done: false,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    deviceId: null,
    userId: 'user-1',
    deletedAt: null,
    ...overrides,
  }
}

const todos = [
  todo({ id: 'backlog' }),
  todo({ id: 'current-done', weekNumber: CURRENT, done: true, createdAt: 1 }),
  todo({ id: 'current-open', weekNumber: CURRENT, createdAt: 2 }),
  todo({ id: 'next-year', weekNumber: 202702 }),
  todo({ id: 'next-week', weekNumber: 202647 }),
  todo({ id: 'past-open', weekNumber: 202640 }),
  todo({ id: 'past-done', weekNumber: 202640, done: true, updatedAt: 5 }),
  todo({ id: 'archived', weekNumber: 202640, archived: true }),
  todo({ id: 'deleted', weekNumber: CURRENT, deletedAt: 3 }),
]

function ids(list: Todo[]) {
  return list.map((item) => item.id)
}

test('filterLane splits todos into planning lanes', () => {
  assert.deepEqual(ids(filterLane(todos, 'backlog', CURRENT)), ['backlog'])
  // Open work sorts above done work.
  assert.deepEqual(ids(filterLane(todos, 'current', CURRENT)), ['current-open', 'current-done'])
  assert.deepEqual(ids(filterLane(todos, 'future', CURRENT)), ['next-week', 'next-year'])
  assert.deepEqual(ids(filterLane(todos, 'unfinished', CURRENT)), ['past-open'])
  assert.deepEqual(ids(filterLane(todos, 'finished', CURRENT)), ['past-done', 'current-done'])
  assert.deepEqual(ids(filterLane(todos, 'archived', CURRENT)), ['archived'])
})

test('groupByWeek orders weeks across year boundaries', () => {
  const groups = groupByWeek(filterLane(todos, 'future', CURRENT), CURRENT, 'asc')

  assert.deepEqual(
    groups.map((group) => [group.title, group.meta]),
    [
      ['Next week', 'Nov 16 – 22'],
      ['Week 2 · 2027', 'Jan 11 – 17'],
    ],
  )
})

test('getQuickMove suggests the next sensible week', () => {
  assert.deepEqual(getQuickMove(todo({ id: 'a' }), CURRENT), {
    label: 'This week',
    weekNumber: CURRENT,
  })
  assert.deepEqual(getQuickMove(todo({ id: 'b', weekNumber: CURRENT }), CURRENT), {
    label: 'Next week',
    weekNumber: 202647,
  })
  assert.equal(getQuickMove(todo({ id: 'c', weekNumber: CURRENT, done: true }), CURRENT), null)
})
