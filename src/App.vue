<script setup lang="ts">
import { Archive, Calendar, CheckCircle, Clock, Inbox, Layers } from 'lucide-vue-next'
import { maxLength, minLength, pipe, regex, safeParse, string } from 'valibot'
import { computed, ref, useId } from 'vue'
import { useRoute } from 'vue-router'
import AuthStatus from './components/AuthStatus.vue'
import { useElectricTodos } from './composables/useElectricTodos'
import { useCreateTodoValidationState } from './composables/useCreateTodoValidationState'
import { useWeekNumber } from './composables/useWeekNumber'
import SyncStatus from './components/SyncStatus.vue'

const route = useRoute()
const { getCurrentWeekNumber } = useWeekNumber()
const { addTodo, canCreateTodos, createTodoDisabledReason, migration } = useElectricTodos()
const migrationState = computed(() => migration.value)

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

function createTodo() {
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

  addTodo(trimmedLabel, newTodoWeek.value)
  validation.clearError()
  newTodoLabel.value = ''
  newTodoWeek.value = null
}

const navItems = [
  { path: '/backlog', label: 'Backlog', icon: Inbox },
  { path: '/current-week', label: 'Current', icon: Calendar },
  { path: '/future', label: 'Future', icon: Layers },
  { path: '/unfinished', label: 'Unfinished', icon: Clock },
  { path: '/finished', label: 'Finished', icon: CheckCircle },
  { path: '/archived', label: 'Archived', icon: Archive },
]

function getNavLinkClass(path: string): string {
  return route.path === path
    ? 'bg-navy text-white shadow-md'
    : 'bg-transparent text-text-secondary hover:bg-cream'
}

const id = useId()
</script>

<template>
  <div class="mx-auto min-h-screen max-w-3xl px-6 py-8">
    <header class="mb-6 flex items-start justify-between sm:mb-8 lg:mb-10">
      <div>
        <h1
          class="mb-1 font-[Playfair_Display] text-2xl font-bold tracking-tight text-navy sm:mb-2 sm:text-3xl lg:text-4xl"
        >
          Editorial Tasks
        </h1>
        <p class="hidden font-[Source_Sans_3] text-sm text-text-muted sm:block">
          Organize your editorial planning with precision
        </p>
      </div>
      <div class="flex flex-col items-end gap-3">
        <SyncStatus />
        <AuthStatus />
      </div>
    </header>

    <nav class="mb-6 flex flex-wrap gap-2 sm:mb-8">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :title="item.label"
        :class="getNavLinkClass(item.path)"
        class="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200 ease-out sm:px-4"
      >
        <component :is="item.icon" class="size-4" stroke-width="1.5" />
        <span class="hidden sm:inline">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <form class="mb-6" @submit.prevent="createTodo">
      <div class="rounded-lg border border-border bg-white p-4 shadow-sm">
        <label
          :for="`${id}-new`"
          class="mb-1.5 block text-xs font-medium tracking-wide text-text-muted uppercase"
        >
          New Task
        </label>
        <input
          :id="`${id}-new`"
          v-model="newTodoLabel"
          placeholder="What needs to be done?"
          required
          class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base text-navy transition-all duration-200 placeholder:text-gray-400 focus:border-navy focus:ring-1 focus:ring-navy/10 focus:outline-none"
        />
        <div
          :class="
            newTodoLabel.trim().length > 0 ? 'mt-3 max-h-20 opacity-100' : 'mt-0 max-h-0 opacity-0'
          "
          class="flex flex-wrap items-end gap-3 overflow-hidden transition-all duration-300 ease-in-out"
        >
          <div class="w-40">
            <label
              :for="`${id}-week`"
              class="mb-1.5 block text-xs font-medium tracking-wide text-text-muted uppercase"
            >
              Week
            </label>
            <select
              :id="`${id}-week`"
              v-model="newTodoWeek"
              class="w-full cursor-pointer appearance-none rounded-lg border border-border bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%234a4a5a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[1rem] bg-position-[right_0.5rem_center] bg-no-repeat px-3 py-2.5 pr-10 text-base text-navy transition-all duration-200 focus:border-navy focus:ring-1 focus:ring-navy/10 focus:outline-none"
            >
              <option :value="null">Backlog</option>
              <option :value="currentWeek">Week {{ currentWeek }}</option>
              <option :value="currentWeek + 1">Week {{ currentWeek + 1 }}</option>
              <option :value="currentWeek + 2">Week {{ currentWeek + 2 }}</option>
            </select>
          </div>
          <div class="flex flex-col">
            <span
              class="mb-1.5 block text-xs font-medium tracking-wide text-transparent uppercase select-none"
              aria-hidden="true"
            >
              Action
            </span>
            <button
              type="submit"
              :disabled="!canCreateTodos"
              :title="createTodoDisabledReason ?? undefined"
              class="cursor-pointer rounded-lg border border-transparent bg-navy px-6 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-blue-600 hover:shadow-md active:scale-[0.98]"
            >
              Add Task
            </button>
          </div>
        </div>
      </div>
    </form>

    <div
      v-if="validationError"
      class="animate-shake mb-6 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger"
    >
      <span class="font-medium">Error:</span> {{ validationError }}
    </div>

    <RouterView />

    <section class="mt-10 border-t border-border pt-8">
      <h2 class="mb-4 text-xs font-medium tracking-wide text-text-muted uppercase">
        Data Management
      </h2>
      <div class="rounded-lg border border-border bg-cream px-4 py-3 text-sm text-text-muted">
        <template v-if="migrationState.status === 'available'">
          <p v-if="migrationState.stagedTodoCount > 0">
            {{ migrationState.stagedTodoCount }} staged task{{
              migrationState.stagedTodoCount === 1 ? '' : 's'
            }}
            {{ migrationState.stagedTodoCount === 1 ? 'is' : 'are' }} ready to keep in this account.
          </p>
          <p v-else>No staged tasks are available to keep.</p>
          <p class="mt-2">
            Signed-out users stay in migration review until the approved account signs in and keeps
            the staged tasks.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-if="migrationState.canKeep || migrationState.keepDisabledReason"
              type="button"
              :disabled="!migrationState.canKeep"
              :title="migrationState.keepDisabledReason ?? undefined"
              class="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600"
              @click="migrationState.keep()"
            >
              Keep staged tasks
            </button>
            <button
              type="button"
              class="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white"
              @click="migrationState.decline()"
            >
              Decline migration
            </button>
          </div>
          <p v-if="migrationState.keepDisabledReason" class="mt-2 text-xs text-text-muted">
            {{ migrationState.keepDisabledReason }}
          </p>
        </template>
        <p v-else-if="migrationState.status === 'promoting'">
          Migration is in progress. Staged tasks will appear after sync confirms them.
        </p>
        <p v-else-if="migrationState.status === 'declined'">
          Staged legacy/imported tasks were declined and remain quarantined outside the synced view.
        </p>
        <p v-else>
          Imports stage tasks for migration review before sync. Signed-out access is limited to
          migration review until the approved account signs in and keeps the staged tasks.
        </p>
      </div>
    </section>
  </div>
</template>
