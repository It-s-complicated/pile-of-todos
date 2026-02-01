<script setup lang="ts">
import type { Todo } from '../db/collections'
import { useLiveQuery } from '@tanstack/vue-db'
import { FileText } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useWeekNumber } from '../composables/useWeekNumber'
import { todosCollection } from '../db/collections'
import { useTodosStore } from '../stores/todos'
import TodoItem from './TodoItem.vue'
import WeekSelector from './WeekSelector.vue'

const store = useTodosStore()
const { updateTodo, archiveTodo, VALID_FILTERS } = store
const { getCurrentWeekNumber } = useWeekNumber()
const route = useRoute()

const currentWeek = getCurrentWeekNumber()
const rawFilter = computed(() => (route.params.filter as typeof VALID_FILTERS[number]) || (route.name as typeof VALID_FILTERS[number]))
const filter = computed(() => VALID_FILTERS.includes(rawFilter.value) ? rawFilter.value : 'backlog')

// Single live query for all todos - called in component context
const { data: allTodos, isReady } = useLiveQuery(q =>
  q.from({ todo: todosCollection }),
)

// Loading state
const loading = computed(() => !isReady.value)

// Filtered todos computed from the live query
const filteredTodos = computed(() => {
  const todos = allTodos.value ?? []

  switch (filter.value) {
    case 'backlog':
      return todos.filter(t => t.weekNumber === null && !t.archived)
    case 'current-week':
      return todos.filter(t => t.weekNumber === currentWeek && !t.archived)
    case 'future':
      return todos.filter(t => t.weekNumber !== null && t.weekNumber > currentWeek && !t.archived)
    case 'unfinished':
      return todos.filter(t => t.weekNumber !== null && t.weekNumber < currentWeek && !t.done && !t.archived)
    case 'archived':
      return todos.filter(t => t.archived === true)
    case 'finished':
      return todos.filter(t => t.done === true && t.archived === false)
    default:
      return todos
  }
})

const showWeekSelector = ref(false)
const selectedTodo = ref<Todo | null>(null)

function handleUpdate(id: string, updates: Partial<Todo>) {
  updateTodo(id, updates)
}

function handleArchive(id: string) {
  archiveTodo(id)
}

function handleMove(todo: Todo) {
  selectedTodo.value = todo
  showWeekSelector.value = true
}

function closeWeekSelector() {
  showWeekSelector.value = false
  selectedTodo.value = null
}

function confirmMove(weekNumber: number | null) {
  if (selectedTodo.value) {
    updateTodo(selectedTodo.value.id, { weekNumber })
  }
  closeWeekSelector()
}

// Determine empty state message based on current view
const emptyStateMessage = computed(() => {
  switch (filter.value) {
    case 'backlog':
      return { title: 'Backlog is empty', subtitle: 'Add tasks without a week assigned' }
    case 'current-week':
      return { title: 'No tasks this week', subtitle: 'Add tasks for the current week' }
    case 'future':
      return { title: 'No future tasks', subtitle: 'Plan ahead by adding tasks for future weeks' }
    case 'unfinished':
      return { title: 'No unfinished tasks', subtitle: 'All past tasks are complete!' }
    case 'finished':
      return { title: 'No completed tasks', subtitle: 'Mark tasks as done to see them here' }
    case 'archived':
      return { title: 'No archived tasks', subtitle: 'Archive tasks to hide them from active views' }
    default:
      return { title: 'No tasks found', subtitle: 'Add your first task to get started' }
  }
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-flex items-center gap-2 text-text-muted">
        <div class="size-5 border-2 border-border border-t-navy rounded-full animate-spin" />
        <span class="text-sm font-medium">Loading tasks...</span>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredTodos.length === 0"
      class="text-center py-16 px-4"
    >
      <div class="inline-flex flex-col items-center gap-4">
        <div class="size-16 rounded-full bg-cream flex items-center justify-center">
          <FileText class="size-8 text-border-hover" stroke-width="1.5" />
        </div>
        <div>
          <p class="font-[Playfair_Display] text-lg font-medium text-navy">
            {{ emptyStateMessage.title }}
          </p>
          <p class="text-sm text-text-muted mt-1">
            {{ emptyStateMessage.subtitle }}
          </p>
        </div>
      </div>
    </div>

    <!-- Todo List -->
    <div v-else class="flex flex-col gap-3">
      <TodoItem
        v-for="(todo, index) in filteredTodos"
        :key="todo.id"
        :todo="todo"
        class="animate-fade-in-up"
        :style="{ animationDelay: `${Math.min(index * 50, 500)}ms` }"
        @update="handleUpdate(todo.id, $event)"
        @archive="handleArchive(todo.id)"
        @move="handleMove(todo)"
      />
    </div>

    <!-- Week Selector Modal -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showWeekSelector"
        class="fixed inset-0 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        @click="closeWeekSelector"
      >
        <div @click.stop>
          <WeekSelector
            :current-week="currentWeek"
            @confirm="confirmMove"
            @cancel="closeWeekSelector"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
