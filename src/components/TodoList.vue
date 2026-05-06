<script setup lang="ts">
import type { Todo } from '@/db/collections'
import { Archive, ArchiveRestore, Calendar, Check } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'

import { useElectricTodos } from '@/composables/useElectricTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

import TodoItem from './TodoItem.vue'
import WeekSelector from './WeekSelector.vue'

const { canMutateTodos, isReady, mutateTodoDisabledReason, updateTodo } = useElectricTodos()
defineProps<{ todos: Todo[] }>()

const loading = computed(() => !isReady.value)
const currentWeek = getCurrentWeekNumber()

const showWeekSelector = ref(false)
const selectedTodo = ref<Todo | null>(null)
const weekSelectorTrigger = ref<HTMLElement | null>(null)

function handleUpdate(id: string, updates: Partial<Todo>) {
  if (!canMutateTodos.value) {
    return
  }

  void updateTodo(id, updates).catch((error) => {
    console.error('Todo update failed:', error)
  })
}

function handleArchive({ id, archived }: Todo, _event?: MouseEvent) {
  handleUpdate(id, { archived: !archived })
}

function handleMove(todo: Todo, event?: MouseEvent) {
  if (!canMutateTodos.value) {
    return
  }

  weekSelectorTrigger.value =
    event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  selectedTodo.value = todo
  showWeekSelector.value = true
}

function closeWeekSelector() {
  showWeekSelector.value = false
  selectedTodo.value = null

  const trigger = weekSelectorTrigger.value
  weekSelectorTrigger.value = null
  void nextTick(() => trigger?.focus())
}

function confirmMove(weekNumber: number | null) {
  if (!selectedTodo.value) {
    closeWeekSelector()
    return
  }

  handleUpdate(selectedTodo.value.id, { weekNumber })
  closeWeekSelector()
}
</script>

<template>
  <div class="space-y-4">
    <div :inert="showWeekSelector || undefined" class="space-y-4">
      <div
        v-if="loading"
        class="space-y-3 rounded-3xl border border-outline-variant/10 bg-surface-container/70 p-4 sm:p-5"
        aria-busy="true"
        aria-live="polite"
      >
        <p class="sr-only">Loading tasks...</p>
        <div
          v-for="index in 3"
          :key="index"
          class="animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-highest/70 p-4"
        >
          <div class="mb-4 h-4 w-3/4 rounded-full bg-surface-bright" />
          <div class="flex gap-2">
            <div class="h-5 w-20 rounded-full bg-surface-bright/70" />
            <div class="h-5 w-16 rounded-full bg-surface-bright/70" />
          </div>
        </div>
      </div>

      <slot name="empty" v-else-if="todos.length === 0" />

      <div v-else class="flex flex-col gap-3">
        <TodoItem
          v-for="(todo, index) in todos"
          :id="todo.id"
          :key="todo.id"
          :can-mutate="canMutateTodos"
          :mutate-disabled-reason="mutateTodoDisabledReason"
          :todo="todo"
          :style="{ '--staggered-animation-delay': `${Math.min(index * 50, 500)}ms` }"
          class="animate-fade-in-up animation-delay-(--staggered-animation-delay)"
          @update="handleUpdate(todo.id, $event)"
        >
          <template #primaryAction>
            <button
              type="button"
              role="checkbox"
              :aria-checked="todo.done"
              :aria-label="todo.done ? 'Mark as incomplete' : 'Mark as complete'"
              :disabled="!canMutateTodos"
              :title="!canMutateTodos ? (mutateTodoDisabledReason ?? undefined) : undefined"
              class="relative mt-0.5 size-11 shrink-0 rounded-full border border-outline-variant/70 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:size-8"
              :class="
                todo.done
                  ? 'border-primary bg-primary text-on-primary'
                  : 'bg-transparent hover:border-primary/70'
              "
              @click="handleUpdate(todo.id, { done: !todo.done })"
            >
              <Check
                v-if="todo.done"
                class="absolute inset-0 h-full w-full p-0.5 text-on-primary transition-transform duration-200"
                :class="{ 'animate-checkmark': todo.done }"
                stroke-width="3"
              />
            </button>
          </template>
          <template #actions>
            <button
              v-for="action in [
                {
                  icon: Calendar,
                  label: 'Move to different week',
                  handler: handleMove,
                  disabled: !canMutateTodos,
                  class: 'hover:text-tertiary',
                  title: canMutateTodos
                    ? 'Move to different week'
                    : (mutateTodoDisabledReason ?? undefined),
                },
                {
                  icon: todo.archived ? ArchiveRestore : Archive,
                  label: todo.archived ? 'Unarchive' : 'Archive',
                  handler: handleArchive,
                  disabled: !canMutateTodos,
                  class: 'hover:text-secondary',
                  title: canMutateTodos
                    ? todo.archived
                      ? 'Unarchive'
                      : 'Archive'
                    : (mutateTodoDisabledReason ?? undefined),
                },
              ]"
              type="button"
              :key="action.label"
              :disabled="action.disabled"
              :title="action.title"
              class="inline-flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-all duration-150 hover:bg-surface-container-highest active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:size-9"
              :class="action.class"
              @click="action.handler(todo, $event)"
            >
              <component :is="action.icon" class="size-4" stroke-width="1.8" />
            </button>
          </template>
        </TodoItem>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showWeekSelector"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-surface/70 p-3 backdrop-blur-2xl sm:p-4"
        @click="closeWeekSelector"
      >
        <div class="w-full max-w-md" @click.stop>
          <WeekSelector
            :current-week="currentWeek"
            :selected-week="selectedTodo?.weekNumber"
            @confirm="confirmMove"
            @cancel="closeWeekSelector"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
