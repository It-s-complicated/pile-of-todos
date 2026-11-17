import { computed, type ComputedRef } from 'vue'

import type { Todo } from '@/db/collections'
import { filterLane, type LaneId } from '@/lib/lanes'

import { useCurrentWeek } from './useCurrentWeek'
import { useTodos } from './useTodos'

export function useLane(lane: LaneId): ComputedRef<Todo[]> {
  const { todos } = useTodos()
  const currentWeek = useCurrentWeek()

  return computed(() => filterLane(todos.value, lane, currentWeek.value))
}
