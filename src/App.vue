<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AuthStatus from './components/AuthStatus.vue'
import NewTodoForm from './components/NewTodoForm.vue'
import SyncStatus from './components/SyncStatus.vue'
import { useElectricTodos } from './composables/useElectricTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

type WorkspaceCopy = {
  subtitle?: string
  title: string
}

const route = useRoute()
const { isOnline, offlineQueue } = useElectricTodos()
const offlineQueueState = computed(() => offlineQueue.value)
const currentWeek = getCurrentWeekNumber()

const workspaceCopy: Record<string, WorkspaceCopy> = {
  '/backlog': {
    title: 'The Backlog',
  },
  '/current': {
    title: `Current Week · ${currentWeek}`,
  },
  '/future': {
    title: 'Future Week',
  },
  '/unfinished': {
    title: 'Unfinished',
  },
  '/finished': {
    title: 'Completed',
  },
  '/archived': {
    title: 'Archives',
  },
}

const activeWorkspace = computed(() => workspaceCopy[route.path] ?? workspaceCopy['/backlog'])

const navItems = [
  { label: 'Backlog', path: '/backlog' },
  { label: 'Current Week', path: '/current' },
  { label: 'Future Week', path: '/future' },
  { label: 'Unfinished', path: '/unfinished' },
  { label: 'Completed', path: '/finished' },
  { label: 'Archived', path: '/archived' },
] as const
</script>

<template>
  <div class="min-h-screen text-on-surface">
    <header
      class="sticky top-0 z-40 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-2xl"
    >
      <div
        class="mx-auto grid max-w-screen-2xl gap-4 px-6 py-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center lg:px-8"
      >
        <div class="flex items-center justify-between gap-6">
          <div class="min-w-0">
            <p class="font-headline text-2xl font-extrabold tracking-tight text-primary">Pile</p>
            <p class="mt-1 text-[10px] tracking-[0.32em] text-on-surface-variant uppercase">
              Dashboard
            </p>
          </div>
        </div>

        <nav
          class="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            :class="{
              'font-semibold text-primary': route.path === item.path,
              'text-on-surface-variant hover:text-primary': route.path !== item.path,
            }"
            :aria-current="route.path === item.path ? 'page' : undefined"
            class="relative shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-surface-container"
          >
            <span>{{ item.label }}</span>
            <span
              v-if="route.path === item.path"
              aria-hidden="true"
              class="absolute inset-x-3 bottom-1 block h-px bg-primary"
            />
          </RouterLink>
        </nav>

        <div class="flex items-center gap-3 md:justify-self-end">
          <SyncStatus class="shrink-0" />
          <AuthStatus class="shrink-0" />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-6 pt-12 pb-72 lg:px-8">
      <section class="mb-14 sm:mb-16">
        <h1
          class="font-headline text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl lg:text-6xl"
        >
          {{ activeWorkspace.title }}
        </h1>
      </section>

      <RouterView />

      <section class="mt-16 border-t border-outline-variant/10 pt-10">
        <h2 class="mb-4 text-xs font-medium tracking-[0.32em] text-on-surface-variant uppercase">
          Sync Model
        </h2>
        <div
          class="rounded-3xl border border-outline-variant/10 bg-surface-container/80 px-5 py-4 text-sm text-on-surface-variant shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          <p v-if="offlineQueueState.count > 0 && !isOnline">
            {{ offlineQueueState.count }} queued task{{ offlineQueueState.count === 1 ? '' : 's' }}
            will be created when the connection returns.
          </p>
          <p v-else-if="offlineQueueState.count > 0 && offlineQueueState.isFlushing">
            Queued tasks are being written and will appear when syncing catches up.
          </p>
          <p v-else-if="offlineQueueState.count > 0">
            Queued tasks are ready to sync and will appear as soon as syncing refreshes the live
            view.
          </p>
          <p v-else>
            Todo views come only from live queries. The app stores local data only for newly created
            offline tasks until it can finally persist them.
          </p>
          <p v-if="offlineQueueState.lastError" class="text-danger mt-2 text-xs">
            {{ offlineQueueState.lastError }}
          </p>
        </div>
      </section>
    </main>

    <NewTodoForm />
  </div>
</template>
