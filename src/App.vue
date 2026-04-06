<script setup lang="ts">
import { maxLength, minLength, pipe, regex, safeParse, string } from 'valibot'
import { computed, ref, useId } from 'vue'
import { useRoute } from 'vue-router'

import AuthStatus from './components/AuthStatus.vue'
import SyncStatus from './components/SyncStatus.vue'
import { useCreateTodoValidationState } from './composables/useCreateTodoValidationState'
import { useElectricTodos } from './composables/useElectricTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

type WorkspaceCopy = {
  subtitle: string
  title: string
}

const route = useRoute()
const { addTodo, canCreateTodos, createTodoDisabledReason, isOnline, offlineQueue } =
  useElectricTodos()
const offlineQueueState = computed(() => offlineQueue.value)

const newTodoLabel = ref('')
const newTodoWeek = ref<number | null>(null)
const currentWeek = getCurrentWeekNumber()
const validation = useCreateTodoValidationState({ canCreateTodos })
const validationError = validation.error

const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)

const workspaceCopy: Record<string, WorkspaceCopy> = {
  '/backlog': {
    subtitle: 'Unscheduled tasks waiting to be organized.',
    title: 'The Backlog',
  },
  '/current-week': {
    subtitle: `Week ${currentWeek} · Tasks for this week.`,
    title: 'Current Week',
  },
  '/future': {
    subtitle: 'Planning the calm before the flow.',
    title: 'Future Week',
  },
  '/unfinished': {
    subtitle: 'Past week tasks that still need attention.',
    title: 'Unfinished',
  },
  '/finished': {
    subtitle: 'Tasks that have been checked off.',
    title: 'Completed',
  },
  '/archived': {
    subtitle: 'Tasks that have been archived for reference.',
    title: 'Archives',
  },
}

const activeWorkspace = computed(() => workspaceCopy[route.path] ?? workspaceCopy['/backlog'])

const navItems = [
  { label: 'Backlog', path: '/backlog' },
  { label: 'Current Week', path: '/current-week' },
  { label: 'Future Week', path: '/future' },
  { label: 'Unfinished', path: '/unfinished' },
  { label: 'Completed', path: '/finished' },
  { label: 'Archived', path: '/archived' },
] as const

function getNavLinkClass(path: string): string {
  return route.path === path
    ? 'text-primary font-semibold'
    : 'text-on-surface-variant hover:text-primary'
}

async function createTodo() {
  if (!canCreateTodos.value) {
    validation.setGateError(createTodoDisabledReason.value ?? 'You cannot create todos right now.')
    return
  }

  const trimmedLabel = newTodoLabel.value.trim()
  const result = safeParse(TodoLabelSchema, trimmedLabel)

  if (!result.success) {
    validation.setValidationError(result.issues[0].message)
    return
  }

  try {
    await addTodo(trimmedLabel, newTodoWeek.value)
    validation.clearError()
    newTodoLabel.value = ''
    newTodoWeek.value = null
  } catch (error) {
    validation.setGateError(error instanceof Error ? error.message : 'Unable to create todo.')
  }
}

const id = useId()
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
            <p class="font-headline text-2xl font-extrabold tracking-tight text-primary">
              SoloFlow
            </p>
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
            :class="getNavLinkClass(item.path)"
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
        <p class="mt-3 max-w-2xl text-base text-on-surface-variant sm:text-lg">
          {{ activeWorkspace.subtitle }}
        </p>
      </section>

      <div
        v-if="validationError"
        class="animate-shake mb-8 flex max-w-2xl items-center gap-2 rounded-2xl border border-error/20 bg-error-container/30 px-4 py-3 text-sm text-on-error-container"
      >
        <span class="font-semibold text-error">Error:</span>
        <span>{{ validationError }}</span>
      </div>

      <RouterView />

      <section class="mt-16 border-t border-outline-variant/10 pt-10">
        <h2 class="mb-4 text-xs font-medium tracking-[0.32em] text-on-surface-variant uppercase">
          Sync Model
        </h2>
        <div
          class="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container/80 px-5 py-4 text-sm text-on-surface-variant shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          <p v-if="offlineQueueState.count > 0 && !isOnline">
            {{ offlineQueueState.count }} queued task{{ offlineQueueState.count === 1 ? '' : 's' }}
            will be created in Supabase when the connection returns.
          </p>
          <p v-else-if="offlineQueueState.count > 0 && offlineQueueState.isFlushing">
            Queued tasks are being written to Supabase and will appear when Electric catches up.
          </p>
          <p v-else-if="offlineQueueState.count > 0">
            Queued tasks are ready to sync and will appear as soon as Electric refreshes the live
            view.
          </p>
          <p v-else>
            Todo views come only from Electric live queries. The app stores local data only for
            newly created offline tasks until it can write them to Supabase.
          </p>
          <p v-if="offlineQueueState.lastError" class="text-danger mt-2 text-xs">
            {{ offlineQueueState.lastError }}
          </p>
        </div>
      </section>
    </main>

    <form
      class="fixed bottom-4 left-1/2 z-40 w-[min(100%-1rem,48rem)] -translate-x-1/2"
      @submit.prevent="createTodo"
    >
      <div
        class="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container/90 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
      >
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div class="space-y-1.5">
            <label
              :for="`${id}-new`"
              class="block text-[10px] font-semibold tracking-[0.3em] text-on-surface-variant uppercase"
            >
              New Task
            </label>
            <input
              :id="`${id}-new`"
              v-model="newTodoLabel"
              placeholder="What needs to be done?"
              required
              class="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-4 py-3 text-base text-on-surface transition-all duration-200 placeholder:text-on-surface-variant/70 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            :disabled="!canCreateTodos"
            :title="createTodoDisabledReason ?? undefined"
            class="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold tracking-[0.18em] whitespace-nowrap text-on-primary uppercase transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#c4d3ca] hover:shadow-[0_10px_24px_rgba(184,203,193,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Task
          </button>
        </div>

        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-40 opacity-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="max-h-40 opacity-100"
          leave-to-class="max-h-0 opacity-0"
        >
          <div v-if="newTodoLabel.trim().length > 0" class="mt-3 overflow-hidden">
            <div class="flex flex-wrap items-end gap-3">
              <div class="w-full max-w-56">
                <label
                  :for="`${id}-week`"
                  class="mb-1.5 block text-[10px] font-semibold tracking-[0.3em] text-on-surface-variant uppercase"
                >
                  Week
                </label>
                <select
                  :id="`${id}-week`"
                  v-model="newTodoWeek"
                  class="w-full cursor-pointer appearance-none rounded-2xl border border-outline-variant/10 bg-surface-container-highest bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a8abb0%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat px-4 py-3 pr-10 text-sm text-on-surface transition-all duration-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none"
                >
                  <option :value="null">Backlog</option>
                  <option :value="currentWeek">Week {{ currentWeek }}</option>
                  <option :value="currentWeek + 1">Week {{ currentWeek + 1 }}</option>
                  <option :value="currentWeek + 2">Week {{ currentWeek + 2 }}</option>
                </select>
              </div>
              <p class="pb-3 text-xs text-on-surface-variant">Backlog by default.</p>
            </div>
          </div>
        </Transition>
      </div>
    </form>
  </div>
</template>
