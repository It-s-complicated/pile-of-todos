<script setup lang="ts">
import type { Todo, TodoFilter } from '@/db/collections'
import { Inbox } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { useElectricTodos } from '@/composables/useElectricTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

import TodoItem from './TodoItem.vue'
import WeekSelector from './WeekSelector.vue'

const { canMutateTodos, isReady, mutateTodoDisabledReason, todos, updateTodo } = useElectricTodos()
const props = defineProps<{ filter: TodoFilter }>()

const currentWeek = getCurrentWeekNumber()
const loading = computed(() => !isReady.value)

const filteredTodos = computed(() => {
  const visibleTodos = todos.value.filter((todo) => todo.deletedAt === null)

  switch (props.filter) {
    case 'backlog':
      return visibleTodos.filter((todo) => todo.weekNumber === null && !todo.archived)
    case 'current-week':
      return visibleTodos.filter((todo) => todo.weekNumber === currentWeek && !todo.archived)
    case 'future':
      return visibleTodos.filter(
        (todo) => todo.weekNumber !== null && todo.weekNumber > currentWeek && !todo.archived,
      )
    case 'unfinished':
      return visibleTodos.filter(
        (todo) =>
          todo.weekNumber !== null && todo.weekNumber < currentWeek && !todo.done && !todo.archived,
      )
    case 'archived':
      return visibleTodos.filter((todo) => todo.archived)
    case 'finished':
      return visibleTodos.filter((todo) => todo.done && !todo.archived)
    default:
      return visibleTodos
  }
})

const showWeekSelector = ref(false)
const selectedTodo = ref<Todo | null>(null)

function handleUpdate(id: string, updates: Partial<Todo>) {
  if (!canMutateTodos.value) {
    return
  }

  void updateTodo(id, updates).catch((error) => {
    console.error('Todo update failed:', error)
  })
}

function handleArchive(id: string) {
  handleUpdate(id, { archived: true })
}

function handleMove(todo: Todo) {
  if (!canMutateTodos.value) {
    return
  }

  selectedTodo.value = todo
  showWeekSelector.value = true
}

function closeWeekSelector() {
  showWeekSelector.value = false
  selectedTodo.value = null
}

function confirmMove(weekNumber: number | null) {
  if (!selectedTodo.value) {
    closeWeekSelector()
    return
  }

  handleUpdate(selectedTodo.value.id, { weekNumber })
  closeWeekSelector()
}

const emptyStateMessage = computed(() => {
  switch (props.filter) {
    case 'backlog':
      return { title: 'Backlog is empty', subtitle: 'Add tasks without a week assigned.' }
    case 'current-week':
      return { title: 'No tasks this week', subtitle: 'Add tasks for the current week.' }
    case 'future':
      return { title: 'No future tasks', subtitle: 'Plan ahead by adding tasks for future weeks.' }
    case 'unfinished':
      return { title: 'No unfinished tasks', subtitle: 'All past tasks are complete!' }
    case 'finished':
      return { title: 'No completed tasks', subtitle: 'Mark tasks as done to see them here.' }
    case 'archived':
      return {
        title: 'No archived tasks',
        subtitle: 'Archive tasks to hide them from active views.',
      }
    default:
      return { title: 'No tasks found', subtitle: 'Add your first task to get started.' }
  }
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="loading"
      class="flex min-h-56 items-center justify-center rounded-3xl border border-outline-variant/10 bg-surface-container/70 px-6 py-14 text-center"
    >
      <div class="inline-flex items-center gap-3 text-on-surface-variant">
        <div
          class="size-5 animate-spin rounded-full border-2 border-outline-variant/20 border-t-primary"
        />
        <span class="text-sm font-medium">Loading tasks...</span>
      </div>
    </div>

    <div
      v-else-if="filteredTodos.length === 0"
      class="rounded-3xl border border-outline-variant/10 bg-surface-container/70 px-6 py-16 text-center shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
    >
      <div class="inline-flex flex-col items-center gap-4">
        <div
          class="flex size-16 items-center justify-center rounded-full bg-surface-container-highest text-primary"
        >
          <Inbox class="size-8" stroke-width="1.5" />
        </div>
        <div>
          <p class="font-headline text-lg font-semibold tracking-tight text-on-surface">
            {{ emptyStateMessage.title }}
          </p>
          <p class="mt-2 text-sm text-on-surface-variant">
            {{ emptyStateMessage.subtitle }}
          </p>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-3">
      <TodoItem
        v-for="(todo, index) in filteredTodos"
        :id="todo.id"
        :key="todo.id"
        :can-mutate="canMutateTodos"
        :mutate-disabled-reason="mutateTodoDisabledReason"
        :todo="todo"
        :style="{ '--staggered-animation-delay': `${Math.min(index * 50, 500)}ms` }"
        class="animate-fade-in-up animation-delay-(--staggered-animation-delay)"
        @update="handleUpdate(todo.id, $event)"
        @archive="handleArchive(todo.id)"
        @move="handleMove(todo)"
      />
    </div>

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
        class="fixed inset-0 z-50 flex items-center justify-center bg-surface/70 p-4 backdrop-blur-2xl"
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
