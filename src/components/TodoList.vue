<script setup lang="ts">
import type { Todo } from '../types/todo'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
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
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="loading" class="text-center py-8 text-gray-500">
      Loading...
    </div>
    <div v-else-if="filteredTodos.length === 0" class="text-center py-8 text-gray-400">
      No todos yet
    </div>
    <div v-else class="flex flex-col gap-3">
      <TodoItem
        v-for="todo in filteredTodos"
        :key="todo.id"
        :todo="todo"
        @update="handleUpdate(todo.id, $event)"
        @archive="handleArchive(todo.id)"
        @move="handleMove(todo)"
      />
    </div>

    <div v-if="showWeekSelector" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" @click="closeWeekSelector">
      <div class="bg-white rounded-lg max-w-md w-full" @click.stop>
        <WeekSelector
          :current-week="currentWeek"
          @confirm="confirmMove"
          @cancel="closeWeekSelector"
        />
      </div>
    </div>
  </div>
</template>
