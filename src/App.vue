<script setup lang="ts">
import { Menu, X } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppToast from './components/AppToast.vue'
import AuthStatus from './components/AuthStatus.vue'
import NewTodoForm from './components/NewTodoForm.vue'
import SyncStatus from './components/SyncStatus.vue'
import { useCurrentWeek } from './composables/useCurrentWeek'
import { useLane } from './composables/useLanes'
import { useTodos } from './composables/useTodos'
import { useAuth } from './composables/useAuth'
import { focusAfterUpdate } from '@/lib/focus'
import { countOpen } from '@/lib/lanes'
import { formatWeekRange, weekKeyWeek } from '@/lib/weeks'
import Logo from './components/Logo.vue'

type WorkspaceCopy = {
  progress?: { done: number; total: number } | null
  subtitle: string
  title: string
}

const navItems = [
  { label: 'Backlog', path: '/backlog' },
  { label: 'Current', path: '/current' },
  { label: 'Future', path: '/future' },
  { label: 'Unfinished', path: '/unfinished' },
  { label: 'Completed', path: '/finished' },
  { label: 'Archived', path: '/archived' },
] as const
const primaryNavItems = navItems.slice(0, 4)
const moreNavItems = navItems.slice(4)

const route = useRoute()
const { offlineQueue } = useTodos()
const { isAuthReady, isAuthenticated } = useAuth()
const currentWeek = useCurrentWeek()
const lanes = {
  backlog: useLane('backlog'),
  current: useLane('current'),
  future: useLane('future'),
  unfinished: useLane('unfinished'),
  finished: useLane('finished'),
  archived: useLane('archived'),
}
const isHeaderMenuOpen = ref(false)
const headerMenuToggle = ref<HTMLButtonElement | null>(null)
const headerMenuPanel = ref<HTMLElement | null>(null)
const headerMenuPanelId = 'more-views-panel'

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** Open tasks per lane, shown quietly next to each nav item. */
const navCounts = computed<Record<string, number>>(() => ({
  '/backlog': countOpen(lanes.backlog.value),
  '/current': countOpen(lanes.current.value),
  '/future': countOpen(lanes.future.value),
  '/unfinished': lanes.unfinished.value.length,
}))

const workspaceCopy = computed<Record<string, WorkspaceCopy>>(() => {
  const current = lanes.current.value
  const done = current.length - countOpen(current)
  const futureWeeks = new Set(lanes.future.value.map((todo) => todo.weekNumber)).size

  return {
    '/backlog': {
      title: 'Backlog',
      subtitle: `${plural(countOpen(lanes.backlog.value), 'task')} without a week`,
    },
    '/current': {
      title: 'This week',
      subtitle: `Week ${weekKeyWeek(currentWeek.value)} · ${formatWeekRange(currentWeek.value)}`,
      progress: current.length > 0 ? { done, total: current.length } : null,
    },
    '/future': {
      title: 'Future weeks',
      subtitle:
        lanes.future.value.length === 0
          ? 'Nothing scheduled ahead yet'
          : `${plural(lanes.future.value.length, 'task')} across ${plural(futureWeeks, 'week')}`,
    },
    '/unfinished': {
      title: 'Unfinished',
      subtitle:
        lanes.unfinished.value.length === 0
          ? 'Nothing left behind'
          : `${plural(lanes.unfinished.value.length, 'open task')} from past weeks — finish, move, or archive`,
    },
    '/finished': {
      title: 'Completed',
      subtitle: `${plural(lanes.finished.value.length, 'task')} done, most recent first`,
    },
    '/archived': {
      title: 'Archive',
      subtitle: `${plural(lanes.archived.value.length, 'task')} out of active planning`,
    },
  }
})

const activeWorkspace = computed(
  () => workspaceCopy.value[route.path] ?? workspaceCopy.value['/current'],
)
const headerMenuToggleLabel = computed(() =>
  isHeaderMenuOpen.value ? 'Close more views' : 'Open more views',
)

function closeHeaderMenu() {
  if (!isHeaderMenuOpen.value) {
    return
  }

  isHeaderMenuOpen.value = false
  focusAfterUpdate(() => headerMenuToggle.value)
}

function toggleHeaderMenu() {
  if (isHeaderMenuOpen.value) {
    closeHeaderMenu()
    return
  }

  isHeaderMenuOpen.value = true
  focusAfterUpdate(() => headerMenuPanel.value?.querySelector<HTMLElement>('a, button') ?? null)
}

function handleHeaderMenuFocusout(event: FocusEvent) {
  if (
    event.relatedTarget instanceof Node &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.contains(event.relatedTarget)
  ) {
    return
  }

  isHeaderMenuOpen.value = false
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeHeaderMenu()
  }
}

watch(() => route.path, closeHeaderMenu)

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <div class="min-h-screen text-on-surface">
    <header
      class="sticky top-0 z-40 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-2xl"
    >
      <div
        class="mx-auto flex max-w-screen-2xl flex-nowrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5 lg:px-6"
      >
        <div
          class="shrink-0 font-headline leading-none"
          role="img"
          aria-label='The logo for "Pile of Todos"'
        >
          <Logo />
        </div>

        <button
          ref="headerMenuToggle"
          type="button"
          class="order-3 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container/80 px-3 text-on-surface shadow-surface-rest transition-all duration-200 hover:bg-surface-container-highest active:scale-[0.98]"
          :aria-controls="headerMenuPanelId"
          :aria-expanded="isHeaderMenuOpen"
          :aria-label="headerMenuToggleLabel"
          @click="toggleHeaderMenu"
        >
          <span class="hidden text-control font-semibold sm:inline">More views</span>
          <Menu v-if="!isHeaderMenuOpen" class="size-4.5" stroke-width="2.2" />
          <X v-else class="size-4.5" stroke-width="2.2" />
        </button>

        <nav
          class="order-2 flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-1 [-ms-overflow-style:none] sm:justify-center sm:bg-transparent sm:p-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Weekly planning views"
        >
          <RouterLink
            v-for="item in primaryNavItems"
            :key="item.path"
            :to="item.path"
            :class="{
              'bg-primary/10 font-semibold text-primary sm:bg-transparent':
                route.path === item.path,
              'text-on-surface-variant hover:text-primary': route.path !== item.path,
            }"
            :aria-current="route.path === item.path ? 'page' : undefined"
            class="relative flex min-h-10 shrink-0 items-center justify-center rounded-2xl px-2 text-center text-caption font-medium transition-all duration-200 hover:bg-surface-container active:scale-[0.98] sm:min-h-9 sm:rounded-lg sm:px-3 sm:text-control"
          >
            <span>{{ item.label }}</span>
            <span
              v-if="navCounts[item.path]"
              class="ml-1.5 text-caption text-on-surface-variant/80 tabular-nums"
              :aria-label="`${navCounts[item.path]} open`"
            >
              {{ navCounts[item.path] }}
            </span>
            <span
              v-if="route.path === item.path"
              aria-hidden="true"
              class="absolute inset-x-3 bottom-0 hidden h-px bg-primary sm:block"
            />
          </RouterLink>
        </nav>
      </div>

      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-125 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <div
          v-if="isHeaderMenuOpen"
          :id="headerMenuPanelId"
          ref="headerMenuPanel"
          class="absolute inset-x-0 top-full z-40"
          @focusout="handleHeaderMenuFocusout"
        >
          <div class="mx-auto flex max-w-screen-2xl justify-end px-3 pb-4 sm:px-5 lg:px-6">
            <div
              class="w-full space-y-4 rounded-3xl border border-outline-variant/10 bg-surface/95 p-4 shadow-overlay md:max-w-md"
            >
              <div class="space-y-2">
                <p
                  class="text-tiny font-semibold tracking-label-wide text-on-surface-variant uppercase"
                >
                  More views
                </p>
                <p class="max-w-[46ch] text-supporting text-on-surface-variant">
                  Completed and archived lanes are quieter history views.
                </p>
                <nav class="grid gap-2 sm:grid-cols-2 md:grid-cols-1" aria-label="More views">
                  <RouterLink
                    v-for="item in moreNavItems"
                    :key="item.path"
                    :to="item.path"
                    :class="{
                      'border-primary/20 bg-primary/10 text-primary': route.path === item.path,
                      'border-outline-variant/10 bg-surface-container/60 text-on-surface-variant hover:text-primary':
                        route.path !== item.path,
                    }"
                    :aria-current="route.path === item.path ? 'page' : undefined"
                    class="flex min-h-11 items-center rounded-2xl border px-3 py-3 text-control font-semibold transition-all duration-200 active:scale-[0.99]"
                    @click="closeHeaderMenu"
                  >
                    {{ item.label }}
                  </RouterLink>
                </nav>
              </div>

              <div class="space-y-3 border-t border-outline-variant/10 pt-4">
                <SyncStatus class="w-full" />
                <AuthStatus class="w-full" :show-details-on-mobile="true" />
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </header>

    <div
      v-if="isHeaderMenuOpen"
      aria-hidden="true"
      class="fixed inset-0 z-30 bg-surface/20 backdrop-blur-[1px]"
      @click="closeHeaderMenu"
    />

    <main class="mx-auto max-w-3xl px-4 pt-6 pb-56 sm:px-6 sm:pt-8 sm:pb-48 lg:px-0">
      <section class="mb-6 sm:mb-7">
        <h1
          class="font-headline text-headline font-extrabold tracking-tight text-on-surface trim-both-cap-alphabetic sm:text-display"
        >
          {{ activeWorkspace.title }}
        </h1>
        <p class="mt-3 max-w-[62ch] text-supporting text-on-surface-variant">
          {{ activeWorkspace.subtitle }}
          <template v-if="activeWorkspace.progress">
            · {{ activeWorkspace.progress.done }} of {{ activeWorkspace.progress.total }} done
          </template>
        </p>
        <div
          v-if="activeWorkspace.progress"
          class="mt-3 h-1 max-w-xs overflow-hidden rounded-full bg-surface-container-highest"
          role="progressbar"
          aria-label="This week's progress"
          :aria-valuenow="activeWorkspace.progress.done"
          aria-valuemin="0"
          :aria-valuemax="activeWorkspace.progress.total"
        >
          <div
            class="h-full rounded-full bg-primary/80 transition-[width] duration-300 ease-out"
            :style="{
              width: `${(activeWorkspace.progress.done / activeWorkspace.progress.total) * 100}%`,
            }"
          />
        </div>
      </section>

      <RouterView />

      <section
        v-if="offlineQueue.lastError"
        class="mt-8 rounded-2xl border border-error/20 bg-error-container/25 px-4 py-3 text-supporting text-on-error-container"
        role="alert"
      >
        <p class="text-tiny font-semibold tracking-label-wide text-error uppercase">Sync error</p>
        <p class="mt-1 text-caption">
          {{ offlineQueue.lastError }}
        </p>
      </section>
    </main>

    <div
      class="fixed bottom-3 left-1/2 z-40 flex w-[min(100%-1rem,48rem)] -translate-x-1/2 flex-col gap-2 sm:bottom-4"
    >
      <AppToast />
      <NewTodoForm v-if="isAuthReady && isAuthenticated" />
      <AuthStatus
        v-else-if="isAuthReady"
        :show-details-on-mobile="true"
      />
    </div>
  </div>
</template>
