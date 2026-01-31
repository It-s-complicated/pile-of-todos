<script setup lang="ts">
import type { Todo } from '../types/todo'
import { FileText } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useTodosStore } from '../stores/todos'
import TodoItem from './TodoItem.vue'
import WeekSelector from './WeekSelector.vue'

const store = useTodosStore()
const { filteredTodos, loading, currentWeekNumber: currentWeek } = storeToRefs(store)
const { updateTodo, archiveTodo } = store

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
  // This would need access to the current route filter
  // For now, return a generic message
  return {
    title: 'No tasks found',
    subtitle: 'Add your first task above to get started',
  }
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-flex items-center gap-2 text-text-muted">
        <div class="w-5 h-5 border-2 border-border border-t-navy rounded-full animate-spin" />
        <span class="text-sm font-medium">Loading tasks...</span>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredTodos.length === 0"
      class="text-center py-16 px-4"
    >
      <div class="inline-flex flex-col items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-cream flex items-center justify-center">
          <FileText class="w-8 h-8 text-border-hover" stroke-width="1.5" />
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
