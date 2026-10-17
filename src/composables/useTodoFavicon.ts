import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { Todo } from '@/db/collections'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

function createCountFavicon(count: number): string {
  const label = String(count)
  const fontSize = Math.min(52, 96 / label.length)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect x="8" width="48" height="56" rx="6" fill="#dbe9ff"/>
    <rect x="4" y="4" width="56" height="56" rx="6" fill="#e2bec1"/>
    <rect y="8" width="64" height="56" rx="6" fill="#e2e6eb"/>
    <text x="32" y="38" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#33443c">${label}</text>
  </svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function useTodoFavicon(todos: Readonly<Ref<readonly Todo[]>>): void {
  const currentWeek = ref(getCurrentWeekNumber())
  const count = computed(
    () =>
      todos.value.filter(
        (todo) =>
          todo.weekNumber === currentWeek.value &&
          !todo.done &&
          !todo.archived &&
          todo.deletedAt === null,
      ).length,
  )
  let icon: HTMLLinkElement | null = null
  let originalHref: string | null = null
  let timer: number | undefined

  function refreshWeek(): void {
    currentWeek.value = getCurrentWeekNumber()
  }

  onMounted(() => {
    icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!icon) {
      return
    }

    originalHref = icon.getAttribute('href')
    refreshWeek()
    watch(
      count,
      (value) => {
        if (value > 0) {
          icon?.setAttribute('href', createCountFavicon(value))
        } else if (originalHref !== null) {
          icon?.setAttribute('href', originalHref)
        }
      },
      { immediate: true },
    )
    timer = window.setInterval(refreshWeek, 60_000)
    window.addEventListener('focus', refreshWeek)
  })

  onBeforeUnmount(() => {
    window.clearInterval(timer)
    window.removeEventListener('focus', refreshWeek)
    if (originalHref !== null) {
      icon?.setAttribute('href', originalHref)
    }
  })
}
