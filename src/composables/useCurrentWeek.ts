import { readonly, ref, type Ref } from 'vue'

import { getCurrentWeekKey, type WeekKey } from '@/lib/weeks'

const currentWeek = ref<WeekKey>(getCurrentWeekKey())
let isWatching = false

function refreshCurrentWeek() {
  const nextWeek = getCurrentWeekKey()

  if (nextWeek !== currentWeek.value) {
    currentWeek.value = nextWeek
  }
}

function startWatching() {
  if (isWatching || typeof window === 'undefined') {
    return
  }

  isWatching = true
  // Keep "this week" correct when the app stays open across a week boundary.
  window.addEventListener('focus', refreshCurrentWeek)
  document.addEventListener('visibilitychange', refreshCurrentWeek)
  window.setInterval(refreshCurrentWeek, 60_000)
}

/** The current ISO week key (`YYYYWW`), updated when the week changes. */
export function useCurrentWeek(): Readonly<Ref<WeekKey>> {
  startWatching()
  return readonly(currentWeek)
}
