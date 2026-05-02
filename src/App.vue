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
  { label: 'Current', path: '/current' },
  { label: 'Future', path: '/future' },
  { label: 'Unfinished', path: '/unfinished' },
  { label: 'Completed', path: '/finished' },
  { label: 'Archived', path: '/archived' },
] as const
const primaryNavItems = navItems.slice(0, 4)
const moreNavItems = navItems.slice(4)

const route = useRoute()
const { isOnline, offlineQueue } = useElectricTodos()
const currentWeek = getCurrentWeekNumber()
const isHeaderMenuOpen = ref(false)
const headerMenuPanelId = 'more-views-panel'

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
  isHeaderMenuOpen.value ? 'Close more views' : 'Open more views',
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
        class="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-4 sm:px-6 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:px-8"
      >
        <div class="flex items-center justify-between gap-3 md:contents">
          <div class="font-headline leading-none md:col-start-1 md:row-start-1">
            <p
              class="mb-1.5 text-4xl font-extrabold tracking-tight text-primary trim-both-cap-alphabetic"
            >
              Pile
            </p>
            <p
              class="flex items-baseline justify-center gap-1 text-[0.55rem] font-semibold tracking-loose text-on-surface-variant"
            >
              <span class="trim-both-cap-alphabetic">of</span>
              <span class="text-[0.72rem] tracking-[0.14em] text-primary trim-both-cap-alphabetic"
                >Todos</span
              >
            </p>
          </div>

          <button
            type="button"
            class="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container/80 px-3 text-on-surface shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-colors duration-200 hover:bg-surface-container-highest md:col-start-3 md:row-start-1 md:justify-self-end"
            :aria-controls="headerMenuPanelId"
            :aria-expanded="isHeaderMenuOpen"
            :aria-label="headerMenuToggleLabel"
            @click="toggleHeaderMenu"
          >
            <span class="text-sm font-semibold">More views</span>
            <Menu v-if="!isHeaderMenuOpen" class="size-4.5" stroke-width="2.2" />
            <X v-else class="size-4.5" stroke-width="2.2" />
          </button>
        </div>

        <nav
          class="grid min-w-0 grid-cols-4 items-center gap-1 rounded-2xl border border-outline-variant/10 bg-surface-container-low/70 p-1 md:col-start-2 md:row-start-1 md:mx-auto md:flex md:justify-center md:rounded-full md:bg-transparent md:p-0 md:[-ms-overflow-style:none] md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden"
          aria-label="Weekly planning views"
        >
          <RouterLink
            v-for="item in primaryNavItems"
            :key="item.path"
            :to="item.path"
            :class="{
              'bg-primary/10 font-semibold text-primary md:bg-transparent':
                route.path === item.path,
              'text-on-surface-variant hover:text-primary': route.path !== item.path,
            }"
            :aria-current="route.path === item.path ? 'page' : undefined"
            class="relative rounded-xl px-2 py-2 text-center text-sm font-medium transition-colors duration-200 hover:bg-surface-container md:shrink-0 md:rounded-lg md:px-3"
          >
            <span>{{ item.label }}</span>
            <span
              v-if="route.path === item.path"
              aria-hidden="true"
              class="absolute inset-x-3 bottom-1 hidden h-px bg-primary md:block"
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
          class="absolute inset-x-0 top-full z-40"
        >
          <div class="mx-auto flex max-w-screen-2xl justify-end px-6 pb-4 lg:px-8">
            <div
              class="w-full space-y-4 rounded-3xl border border-outline-variant/10 bg-surface/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.22)] md:max-w-md"
            >
              <div class="space-y-2">
                <p
                  class="text-tiny font-semibold tracking-looser text-on-surface-variant uppercase"
                >
                  More views
                </p>
                <p class="text-sm text-on-surface-variant">
                  Completed and archived lists live here.
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
          class="font-headline text-4xl font-extrabold tracking-tight text-on-surface trim-both-cap-alphabetic sm:text-5xl lg:text-6xl"
        >
          {{ activeWorkspace.title }}
        </h1>
      </section>

      <RouterView />

      <section class="mt-16 border-t border-outline-variant/10 pt-10">
        <h2 class="mb-4 text-xs font-medium tracking-looser text-on-surface-variant uppercase">
          Sync Model
        </h2>
        <div
          class="rounded-3xl border border-outline-variant/10 bg-surface-container/80 px-5 py-4 text-sm text-on-surface-variant shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          <p v-if="offlineQueue.queuedCount > 0 && !isOnline">
            {{ offlineQueue.count }} pending change{{ offlineQueue.count === 1 ? '' : 's' }}
            will sync when the connection returns.
          </p>
          <p v-else-if="offlineQueue.count > 0 && offlineQueue.isFlushing">
            Pending changes are being written and confirmed against the live Electric stream.
          </p>
          <p v-else-if="offlineQueue.acceptedCount > 0">
            {{ offlineQueue.acceptedCount }} accepted change{{
              offlineQueue.acceptedCount === 1 ? '' : 's'
            }}
            awaiting Electric confirmation.
          </p>
          <p v-else-if="offlineQueue.count > 0">
            Queued changes are ready to sync and already appear through the local optimistic
            overlay.
          </p>
          <p v-else>
            Todo views merge the confirmed Electric baseline with a local pending overlay until each
            accepted txid is confirmed.
          </p>
          <p v-if="offlineQueue.lastError" class="text-danger mt-2 text-xs">
            {{ offlineQueue.lastError }}
          </p>
        </div>
      </section>
    </main>

    <NewTodoForm />
  </div>
</template>
