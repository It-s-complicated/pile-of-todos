<script setup lang="ts">
import {
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Inbox,
  Layers,
  Upload,
} from 'lucide-vue-next'
import { maxLength, minLength, pipe, regex, safeParse, string } from 'valibot'
import { ref, useId } from 'vue'
import { useRoute } from 'vue-router'
import { useDataExport } from './composables/useDataExport'
import { useWeekNumber } from './composables/useWeekNumber'
import { getCurrentDeviceId, getActiveCollection } from './db/collections'
import SyncStatus from './components/SyncStatus.vue'

const route = useRoute()
const { getCurrentWeekNumber } = useWeekNumber()
const { exportTodos, importTodos } = useDataExport()

const newTodoLabel = ref('')
const newTodoWeek = ref<number | null>(null)
const currentWeek = getCurrentWeekNumber()
const fileInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const importSuccess = ref(false)
const validationError = ref('')

const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)

async function createTodo() {
  const trimmedLabel = newTodoLabel.value.trim()

  const result = safeParse(TodoLabelSchema, trimmedLabel)

  if (!result.success) {
    validationError.value = result.issues[0].message
    setTimeout(() => {
      validationError.value = ''
    }, 5000)
    return
  }

  getActiveCollection().insert({
    id: crypto.randomUUID(),
    label: trimmedLabel,
    weekNumber: newTodoWeek.value,
    done: false,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deviceId: getCurrentDeviceId(),
  })
  newTodoLabel.value = ''
  newTodoWeek.value = null
}

async function handleExport() {
  try {
    await exportTodos()
    showNotification('Data exported successfully!', true)
  } catch (error) {
    showNotification(
      `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      false,
    )
  }
}

function triggerImport() {
  fileInput.value?.click()
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  try {
    const result = await importTodos(file)
    if (result.success) {
      showNotification(result.message, true)
    } else {
      showNotification(result.message, false)
    }
  } catch (error) {
    showNotification(
      `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      false,
    )
  }

  if (target) {
    target.value = ''
  }
}

function showNotification(message: string, success: boolean) {
  importMessage.value = message
  importSuccess.value = success
  setTimeout(() => {
    importMessage.value = ''
  }, 5000)
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
  const isActive = route.path === path
  return isActive
    ? 'bg-navy text-white shadow-md'
    : 'bg-transparent text-text-secondary hover:bg-cream'
}

const id = useId()
</script>

<template>
  <div class="mx-auto min-h-screen max-w-3xl px-6 py-8">
    <!-- Header -->
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
      <SyncStatus />
    </header>

    <!-- Navigation -->
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

    <!-- Input Form -->
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
              class="cursor-pointer rounded-lg border border-transparent bg-navy px-6 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-blue-600 hover:shadow-md active:scale-[0.98]"
            >
              Add Task
            </button>
          </div>
        </div>
      </div>
    </form>

    <!-- Validation Error -->
    <div
      v-if="validationError"
      class="animate-shake mb-6 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger"
    >
      <span class="font-medium">Error:</span> {{ validationError }}
    </div>

    <!-- Main Content -->
    <RouterView />

    <!-- Settings Area -->
    <section class="mt-10 border-t border-border pt-8">
      <h2 class="mb-4 text-xs font-medium tracking-wide text-text-muted uppercase">
        Data Management
      </h2>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex gap-3">
          <button
            class="flex cursor-pointer items-center gap-2 rounded-lg bg-success-light px-4 py-2 text-sm font-medium text-success-dark transition-all duration-150 hover:bg-[#d8e5dc]"
            @click="handleExport"
          >
            <Download class="size-4" stroke-width="1.5" />
            Export
          </button>
          <button
            class="flex cursor-pointer items-center gap-2 rounded-lg bg-warning-light px-4 py-2 text-sm font-medium text-warning-dark transition-all duration-150 hover:bg-[#f5eadd]"
            @click="triggerImport"
          >
            <Upload class="size-4" stroke-width="1.5" />
            Import
          </button>
        </div>
        <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport" />
      </div>

      <!-- Import Message -->
      <div
        v-if="importMessage"
        :class="{
          'bg-success-light text-success': importSuccess,
          'bg-danger-light text-danger': !importSuccess,
        }"
        class="mt-4 rounded-lg border px-4 py-3 text-sm"
        :style="
          importSuccess
            ? 'border-color: rgba(90, 138, 110, 0.2)'
            : 'border-color: rgba(196, 90, 90, 0.2)'
        "
      >
        {{ importMessage }}
      </div>
    </section>
  </div>
</template>
