<script setup lang="ts">
import { Menu, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const navItems = [
  { label: 'Backlog', path: '/backlog' },
  { label: 'Current Week', path: '/current' },
  { label: 'Future Week', path: '/future' },
  { label: 'Unfinished', path: '/unfinished' },
  { label: 'Completed', path: '/finished' },
  { label: 'Archived', path: '/archived' },
] as const
const primaryNavItems = navItems.slice(0, 3)
const secondaryNavItems = navItems.slice(3)

const route = useRoute()
const { isOnline, offlineQueue } = useElectricTodos()
const offlineQueueState = computed(() => offlineQueue.value)
const currentWeek = getCurrentWeekNumber()
const isHeaderMenuOpen = ref(false)
const headerMenuPanelId = 'header-menu-panel'

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
const headerMenuToggleLabel = computed(() =>
  isHeaderMenuOpen.value ? 'Close workspace menu' : 'Open workspace menu',
)

function closeHeaderMenu() {
  isHeaderMenuOpen.value = false
}

function toggleHeaderMenu() {
  isHeaderMenuOpen.value = !isHeaderMenuOpen.value
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeHeaderMenu()
  }
}

watch(
  () => route.path,
  () => {
    closeHeaderMenu()
  },
)

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
        class="mx-auto grid max-w-screen-2xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-6 py-4 lg:px-8"
      >
        <div class="min-w-0">
          <p class="font-headline text-2xl font-extrabold tracking-tight text-primary">Pile</p>
        </div>

        <nav
          class="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:justify-center md:gap-2 [&::-webkit-scrollbar]:hidden"
        >
          <RouterLink
            v-for="item in primaryNavItems"
            :key="item.path"
            :to="item.path"
            :class="{
              'font-semibold text-primary': route.path === item.path,
              'text-on-surface-variant hover:text-primary': route.path !== item.path,
            }"
            :aria-current="route.path === item.path ? 'page' : undefined"
            class="relative shrink-0 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-surface-container md:rounded-lg"
          >
            <span>{{ item.label }}</span>
            <span
              v-if="route.path === item.path"
              aria-hidden="true"
              class="absolute inset-x-3 bottom-1 block h-px bg-primary"
            />
          </RouterLink>
        </nav>

        <button
          type="button"
          class="inline-flex size-11 items-center justify-center justify-self-end rounded-full border border-outline-variant/10 bg-surface-container/80 text-on-surface shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-colors duration-200 hover:bg-surface-container-highest"
          :aria-controls="headerMenuPanelId"
          :aria-expanded="isHeaderMenuOpen"
          :aria-label="headerMenuToggleLabel"
          @click="toggleHeaderMenu"
        >
          <Menu v-if="!isHeaderMenuOpen" class="size-4.5" stroke-width="2.2" />
          <X v-else class="size-4.5" stroke-width="2.2" />
        </button>
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
          class="absolute inset-x-0 top-full z-40"
        >
          <div class="mx-auto flex max-w-screen-2xl justify-end px-6 pb-4 lg:px-8">
            <div
              class="w-full space-y-4 rounded-3xl border border-outline-variant/10 bg-surface/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.22)] md:max-w-md"
            >
              <div class="space-y-2">
                <p
                  class="text-[10px] font-semibold tracking-[0.28em] text-on-surface-variant uppercase"
                >
                  Saved Views
                </p>
                <nav class="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
                  <RouterLink
                    v-for="item in secondaryNavItems"
                    :key="item.path"
                    :to="item.path"
                    :class="{
                      'border-primary/20 bg-primary/10 text-primary': route.path === item.path,
                      'border-outline-variant/10 bg-surface-container/60 text-on-surface-variant hover:text-primary':
                        route.path !== item.path,
                    }"
                    :aria-current="route.path === item.path ? 'page' : undefined"
                    class="rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors duration-200"
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
