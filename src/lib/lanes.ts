import type { Todo } from '@/db/collections'

import { addWeeks, formatRelativeWeek, formatWeekRange, type WeekKey } from './weeks'

export type LaneId = 'backlog' | 'current' | 'future' | 'unfinished' | 'finished' | 'archived'

export type TodoGroup = {
  id: string
  title: string
  meta: string | null
  weekNumber: WeekKey | null
  todos: Todo[]
}

export type QuickMove = {
  label: string
  weekNumber: WeekKey | null
}

function isLive(todo: Todo) {
  return todo.deletedAt === null
}

/** Open work first, then oldest first so the list order stays stable. */
export function compareTodos(left: Todo, right: Todo): number {
  if (left.done !== right.done) {
    return left.done ? 1 : -1
  }

  return left.createdAt - right.createdAt || left.id.localeCompare(right.id)
}

function byRecentUpdate(left: Todo, right: Todo): number {
  return right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)
}

export function filterLane(todos: readonly Todo[], lane: LaneId, currentWeek: WeekKey): Todo[] {
  const live = todos.filter(isLive)

  switch (lane) {
    case 'backlog':
      return live
        .filter((todo) => todo.weekNumber === null && !todo.archived)
        .toSorted(compareTodos)
    case 'current':
      return live
        .filter((todo) => todo.weekNumber === currentWeek && !todo.archived)
        .toSorted(compareTodos)
    case 'future':
      return live
        .filter(
          (todo) => todo.weekNumber !== null && todo.weekNumber > currentWeek && !todo.archived,
        )
        .toSorted(compareTodos)
    case 'unfinished':
      return live
        .filter(
          (todo) =>
            todo.weekNumber !== null &&
            todo.weekNumber < currentWeek &&
            !todo.done &&
            !todo.archived,
        )
        .toSorted(compareTodos)
    case 'finished':
      return live.filter((todo) => todo.done && !todo.archived).toSorted(byRecentUpdate)
    case 'archived':
      return live.filter((todo) => todo.archived).toSorted(byRecentUpdate)
  }
}

/** Count of open (not done) tasks a lane asks the user to act on. */
export function countOpen(todos: readonly Todo[]): number {
  return todos.reduce((count, todo) => count + (todo.done ? 0 : 1), 0)
}

export function groupByWeek(
  todos: readonly Todo[],
  currentWeek: WeekKey,
  order: 'asc' | 'desc',
): TodoGroup[] {
  const groups = new Map<WeekKey | null, Todo[]>()

  for (const todo of todos) {
    const group = groups.get(todo.weekNumber)

    if (group) {
      group.push(todo)
    } else {
      groups.set(todo.weekNumber, [todo])
    }
  }

  return [...groups.entries()]
    .toSorted(([left], [right]) => {
      // Unscheduled work always goes last.
      if (left === null) return 1
      if (right === null) return -1
      return order === 'asc' ? left - right : right - left
    })
    .map(([weekNumber, groupTodos]) => ({
      id: weekNumber === null ? 'backlog' : String(weekNumber),
      title: weekNumber === null ? 'No week' : formatRelativeWeek(weekNumber, currentWeek),
      meta: weekNumber === null ? null : formatWeekRange(weekNumber),
      weekNumber,
      todos: groupTodos,
    }))
}

/** The single most likely move for a task, offered as a one-tap action. */
export function getQuickMove(todo: Todo, currentWeek: WeekKey): QuickMove | null {
  if (todo.done || todo.archived) {
    return null
  }

  if (todo.weekNumber === currentWeek) {
    return { label: 'Next week', weekNumber: addWeeks(currentWeek, 1) }
  }

  return { label: 'This week', weekNumber: currentWeek }
}
