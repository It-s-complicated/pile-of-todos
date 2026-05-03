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
const { isOnline, offlineQueue } = useElectricTodos()
const currentWeek = getCurrentWeekNumber()
const isHeaderMenuOpen = ref(false)
const headerMenuPanelId = 'more-views-panel'

const workspaceCopy: Record<string, WorkspaceCopy> = {
  '/backlog': {
    title: 'The Backlog',
    subtitle:
      'Capture work that does not have a week yet. Use this lane when you are still triaging.',
  },
  '/current': {
    title: `Current Week · ${currentWeek}`,
    subtitle: `The work you intend to finish in week ${currentWeek}. Keep this lane focused on real commitments.`,
  },
  '/future': {
    title: 'Future Weeks',
    subtitle: 'Scheduled work beyond this week. Use this lane to park commitments for later weeks.',
  },
  '/unfinished': {
    title: 'Unfinished',
    subtitle:
      'Past-week tasks that still need a decision. Finish, reschedule, or move them back to backlog.',
  },
  '/finished': {
    title: 'Completed',
    subtitle: 'Finished tasks stay here until you archive them.',
  },
  '/archived': {
    title: 'Archives',
    subtitle: 'Closed tasks you want out of active planning.',
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
        class="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-5 lg:flex-nowrap lg:px-6"
      >
        <div
          class="shrink-0 font-headline leading-none"
          role="img"
          aria-label='The logo for "Pile of Todos"'
        >
          <p
            class="mb-1 text-3xl font-extrabold tracking-tight text-primary trim-both-cap-alphabetic"
          >
            Pile
          </p>
          <p
            class="flex items-baseline justify-center gap-1 text-[0.48rem] font-semibold tracking-loose text-on-surface-variant"
          >
            <span class="trim-both-cap-alphabetic">of</span>
            <span class="text-[0.62rem] tracking-[0.14em] text-primary trim-both-cap-alphabetic"
              >Todos</span
            >
          </p>
        </div>

        <button
          type="button"
          class="order-2 ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container/80 px-3 text-on-surface shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-all duration-200 hover:bg-surface-container-highest active:scale-[0.98] sm:order-3 sm:min-h-10"
          :aria-controls="headerMenuPanelId"
          :aria-expanded="isHeaderMenuOpen"
          :aria-label="headerMenuToggleLabel"
          @click="toggleHeaderMenu"
        >
          <span class="hidden text-sm font-semibold sm:inline">More views</span>
          <Menu v-if="!isHeaderMenuOpen" class="size-4.5" stroke-width="2.2" />
          <X v-else class="size-4.5" stroke-width="2.2" />
        </button>

        <nav
          class="order-3 grid w-full min-w-0 grid-cols-4 items-center gap-1 rounded-3xl border border-outline-variant/10 bg-surface-container-low/70 p-1 sm:order-2 sm:w-auto sm:flex-1 sm:justify-center sm:bg-transparent sm:p-0 sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
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
            class="relative flex min-h-10 items-center justify-center rounded-2xl px-2 text-center text-sm font-medium transition-all duration-200 hover:bg-surface-container active:scale-[0.98] sm:min-h-9 sm:shrink-0 sm:rounded-lg sm:px-3"
          >
            <span>{{ item.label }}</span>
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
          class="absolute inset-x-0 top-full z-40"
        >
          <div class="mx-auto flex max-w-screen-2xl justify-end px-3 pb-4 sm:px-5 lg:px-6">
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
                    class="flex min-h-11 items-center rounded-2xl border px-3 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.99]"
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

    <main class="mx-auto max-w-3xl px-4 pt-6 pb-80 sm:px-6 sm:pt-8 sm:pb-72 lg:px-0">
      <section class="mb-6 sm:mb-7">
        <h1
          class="font-headline text-headline font-extrabold tracking-tight text-on-surface trim-both-cap-alphabetic sm:text-display"
        >
          {{ activeWorkspace.title }}
        </h1>
        <p class="mt-3 max-w-prose text-sm text-on-surface-variant">
          {{ activeWorkspace.subtitle }}
        </p>
      </section>

      <RouterView />

      <section class="mt-16 border-t border-outline-variant/10 pt-10">
        <h2 class="mb-4 text-tiny font-semibold tracking-loosest text-on-surface-variant uppercase">
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
          <p v-if="offlineQueue.lastError" class="mt-2 text-caption text-error">
            {{ offlineQueue.lastError }}
          </p>
        </div>
      </section>
    </main>

    <NewTodoForm />
  </div>
</template>
