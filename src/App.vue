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
import { todosCollection } from './db/collections'

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

  todosCollection.insert({
    id: crypto.randomUUID(),
    label: trimmedLabel,
    weekNumber: newTodoWeek.value,
    done: false,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  newTodoLabel.value = ''
  newTodoWeek.value = null
}

async function handleExport() {
  try {
    await exportTodos()
    showNotification('Data exported successfully!', true)
  }
  catch (error) {
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

  if (!file)
    return

  try {
    const result = await importTodos(file)
    if (result.success) {
      showNotification(result.message, true)
    }
    else {
      showNotification(result.message, false)
    }
  }
  catch (error) {
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
  <div class="max-w-3xl mx-auto px-6 py-8 min-h-screen">
    <!-- Header -->
    <header class="mb-6 sm:mb-8 lg:mb-10">
      <h1
        class="font-[Playfair_Display] text-2xl sm:text-3xl lg:text-4xl font-bold text-navy mb-1 sm:mb-2 tracking-tight"
      >
        Editorial Tasks
      </h1>
      <p class="text-text-muted text-sm font-[Source_Sans_3] hidden sm:block">
        Organize your editorial planning with precision
      </p>
    </header>

    <!-- Navigation -->
    <nav class="flex gap-2 mb-6 sm:mb-8 flex-wrap">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :title="item.label"
        :class="getNavLinkClass(item.path)"
        class="px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ease-out flex items-center gap-2"
      >
        <component :is="item.icon" class="size-4" stroke-width="1.5" />
        <span class="hidden sm:inline">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Input Form -->
    <form class="mb-6" @submit.prevent="createTodo">
      <div class="bg-white p-4 rounded-lg border border-border shadow-sm">
        <label
          :for="`${id}-new`"
          class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide"
        >
          New Task
        </label>
        <input
          :id="`${id}-new`"
          v-model="newTodoLabel"
          placeholder="What needs to be done?"
          required
          class="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-base text-navy placeholder:text-gray-400 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/10 transition-all duration-200"
        >
        <div
          :class="
            newTodoLabel.trim().length > 0 ? 'max-h-20 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
          "
          class="flex gap-3 flex-wrap items-end overflow-hidden transition-all duration-300 ease-in-out"
        >
          <div class="w-40">
            <label
              :for="`${id}-week`"
              class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide"
            >
              Week
            </label>
            <select
              :id="`${id}-week`"
              v-model="newTodoWeek"
              class="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-base text-navy focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/10 transition-all duration-200 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%234a4a5a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[1rem] bg-position-[right_0.5rem_center] bg-no-repeat pr-10"
            >
              <option :value="null">
                Backlog
              </option>
              <option :value="currentWeek">
                Week {{ currentWeek }}
              </option>
              <option :value="currentWeek + 1">
                Week {{ currentWeek + 1 }}
              </option>
              <option :value="currentWeek + 2">
                Week {{ currentWeek + 2 }}
              </option>
            </select>
          </div>
          <div class="flex flex-col">
            <span
              class="block text-xs font-medium text-transparent mb-1.5 uppercase tracking-wide select-none"
              aria-hidden="true"
            >
              Action
            </span>
            <button
              type="submit"
              class="px-6 py-3 bg-navy text-white rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 hover:bg-blue-600 hover:shadow-md active:scale-[0.98] border border-transparent"
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
      class="bg-danger-light border border-danger/20 text-danger px-4 py-3 mb-6 rounded-lg text-sm flex items-center gap-2 animate-shake"
    >
      <span class="font-medium">Error:</span> {{ validationError }}
    </div>

    <!-- Main Content -->
    <RouterView />

    <!-- Settings Area -->
    <section class="mt-10 pt-8 border-t border-border">
      <h2 class="text-xs font-medium text-text-muted mb-4 uppercase tracking-wide">
        Data Management
      </h2>
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div class="flex gap-3">
          <button
            class="px-4 py-2 bg-success-light text-success-dark rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 hover:bg-[#d8e5dc] flex items-center gap-2"
            @click="handleExport"
          >
            <Download class="size-4" stroke-width="1.5" />
            Export
          </button>
          <button
            class="px-4 py-2 bg-warning-light text-warning-dark rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 hover:bg-[#f5eadd] flex items-center gap-2"
            @click="triggerImport"
          >
            <Upload class="size-4" stroke-width="1.5" />
            Import
          </button>
        </div>
        <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport">
      </div>

      <!-- Import Message -->
      <div
        v-if="importMessage"
        :class="{
          'bg-success-light text-success': importSuccess,
          'bg-danger-light text-danger': !importSuccess,
        }"
        class="mt-4 px-4 py-3 rounded-lg text-sm border"
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
