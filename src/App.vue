<script setup lang="ts">
import { maxLength, minLength, pipe, regex, safeParse, string } from 'valibot'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useDataExport } from './composables/useDataExport'
import { useWeekNumber } from './composables/useWeekNumber'
import { useTodosStore } from './stores/todos'

const route = useRoute()
const store = useTodosStore()
const { getCurrentWeekNumber } = useWeekNumber()
const { loadTodos, addTodo } = store
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

  await addTodo(trimmedLabel, newTodoWeek.value)
  newTodoLabel.value = ''
  newTodoWeek.value = null
}

async function handleExport() {
  try {
    await exportTodos()
    showImportMessage('Data exported successfully!', true)
  }
  catch (error) {
    showImportMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, false)
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
      await loadTodos()
      showImportMessage(result.message, true)
    }
    else {
      showImportMessage(result.message, false)
    }
  }
  catch (error) {
    showImportMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, false)
  }

  if (target) {
    target.value = ''
  }
}

function showImportMessage(message: string, success: boolean) {
  importMessage.value = message
  importSuccess.value = success
  setTimeout(() => {
    importMessage.value = ''
  }, 5000)
}

function navLinkClass(path: string) {
  return route.path === path
    ? 'bg-blue-500 text-white'
    : 'bg-gray-100 text-gray-700'
}

onMounted(() => {
  loadTodos()
})
</script>

<template>
  <div class="max-w-2xl mx-auto p-4">
    <nav class="flex gap-2 mb-6 flex-wrap">
      <RouterLink to="/backlog" :class="navLinkClass('/backlog')" class="px-4 py-2 rounded-md font-medium transition-colors hover:bg-gray-200">
        Backlog
      </RouterLink>
      <RouterLink to="/current-week" :class="navLinkClass('/current-week')" class="px-4 py-2 rounded-md font-medium transition-colors hover:bg-gray-200">
        Current Week
      </RouterLink>
      <RouterLink to="/future" :class="navLinkClass('/future')" class="px-4 py-2 rounded-md font-medium transition-colors hover:bg-gray-200">
        Future
      </RouterLink>
      <RouterLink to="/unfinished" :class="navLinkClass('/unfinished')" class="px-4 py-2 rounded-md font-medium transition-colors hover:bg-gray-200">
        Unfinished
      </RouterLink>
      <RouterLink to="/finished" :class="navLinkClass('/finished')" class="px-4 py-2 rounded-md font-medium transition-colors hover:bg-gray-200">
        Finished
      </RouterLink>
      <RouterLink to="/archived" :class="navLinkClass('/archived')" class="px-4 py-2 rounded-md font-medium transition-colors hover:bg-gray-200">
        Archived
      </RouterLink>
    </nav>

    <form class="flex gap-2 mb-6 flex-wrap" @submit.prevent="createTodo">
      <input v-model="newTodoLabel" placeholder="New todo..." required class="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
      <select v-model="newTodoWeek" class="px-3 py-2 border border-gray-300 rounded-md text-base">
        <option :value="null">
          Backlog
        </option>
        <option :value="currentWeek">
          Current Week ({{ currentWeek }})
        </option>
        <option :value="currentWeek + 1">
          Next Week ({{ currentWeek + 1 }})
        </option>
        <option :value="currentWeek + 2">
          Week {{ currentWeek + 2 }}
        </option>
      </select>
      <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-blue-600">
        Add
      </button>
    </form>

    <div v-if="validationError" class="bg-red-100 text-red-800 p-3 mb-6 rounded-md text-sm">
      {{ validationError }}
    </div>

    <div class="flex gap-2 mb-6 flex-wrap">
      <button class="px-4 py-2 bg-green-100 text-green-800 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-green-200" @click="handleExport">
        Export Data
      </button>
      <button class="px-4 py-2 bg-purple-100 text-purple-800 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-purple-200" @click="triggerImport">
        Import Data
      </button>
      <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport">
    </div>

    <div v-if="importMessage" :class="{ 'bg-green-100 text-green-800': importSuccess, 'bg-red-100 text-red-800': !importSuccess }" class="p-3 mb-6 rounded-md text-sm">
      {{ importMessage }}
    </div>

    <RouterView />
  </div>
</template>
