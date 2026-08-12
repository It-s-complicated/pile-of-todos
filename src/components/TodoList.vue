<script setup lang="ts">
import type { Todo } from '@/db/collections'
import { Archive, ArchiveRestore, Check } from '@lucide/vue'
import { computed } from 'vue'

import { useTodos } from '@/composables/useTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

import TodoItem from './TodoItem.vue'
import WeekSelect from './WeekSelect.vue'

const { canMutateTodos, isReady, mutateTodoDisabledReason, updateTodo } = useTodos()
defineProps<{ todos: Todo[] }>()

const loading = computed(() => !isReady.value)
const currentWeek = getCurrentWeekNumber()

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

function handleMove(todo: Todo, weekNumber: number | null) {
  handleUpdate(todo.id, { weekNumber })
}
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-4">
      <div
        v-if="loading"
        class="rounded-3xl border border-outline-variant/10 bg-surface-container/55 p-3 shadow-surface-rest sm:p-4"
        aria-busy="true"
        aria-live="polite"
      >
        <p class="sr-only">Loading tasks...</p>
        <div class="space-y-3">
          <div
            v-for="index in 3"
            :key="index"
            class="grid animate-pulse grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-3xl border border-outline-variant/10 bg-surface-container p-4 sm:gap-x-4 sm:p-5"
          >
            <div class="size-11 rounded-full border border-outline-variant/20 sm:size-8" />
            <div class="min-w-0 space-y-3 pt-1">
              <div class="h-4 w-10/12 rounded-full bg-surface-bright/75" />
              <div
                class="flex flex-col gap-3 border-t border-outline-variant/8 pt-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div class="flex items-center gap-2">
                  <div class="size-2 rounded-full bg-surface-bright/80" />
                  <div class="h-5 w-24 rounded-full bg-surface-bright/55" />
                  <div class="h-5 w-16 rounded-full bg-surface-bright/45" />
                </div>
                <div class="flex items-center gap-2">
                  <div class="h-10 w-36 rounded-2xl bg-surface-bright/35" />
                  <div class="size-10 rounded-full bg-surface-bright/35" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <slot name="empty" v-else-if="todos.length === 0" />

      <ul v-else role="list" class="flex flex-col gap-3">
        <li
          v-for="(todo, index) in todos"
          :key="todo.id"
          :style="{ '--staggered-animation-delay': `${Math.min(index * 50, 500)}ms` }"
          class="animate-fade-in-up animation-delay-(--staggered-animation-delay)"
        >
          <TodoItem
            :id="todo.id"
            :can-mutate="canMutateTodos"
            :mutate-disabled-reason="mutateTodoDisabledReason"
            :todo="todo"
            @update="handleUpdate(todo.id, $event)"
          >
            <template #primaryAction>
              <button
                type="button"
                role="checkbox"
                :aria-checked="todo.done"
                :aria-label="
                  todo.done ? `Mark incomplete: ${todo.label}` : `Mark complete: ${todo.label}`
                "
                :disabled="!canMutateTodos"
                :title="!canMutateTodos ? (mutateTodoDisabledReason ?? undefined) : undefined"
                class="relative size-11 shrink-0 rounded-full border border-outline-variant/60 transition-[background-color,border-color,color,transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                :class="
                  todo.done
                    ? 'border-primary bg-primary text-on-primary'
                    : 'bg-surface-container-low hover:border-primary/70 hover:bg-surface-container-highest'
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
              <WeekSelect
                :model-value="todo.weekNumber"
                :current-week="currentWeek"
                :disabled="!canMutateTodos"
                :label="`Move task: ${todo.label}`"
                variant="compact"
                class="min-w-0 flex-1 sm:flex-none"
                @update:model-value="handleMove(todo, $event)"
              />
              <button
                v-for="action in [
                  {
                    icon: todo.archived ? ArchiveRestore : Archive,
                    label: todo.archived ? `Unarchive: ${todo.label}` : `Archive: ${todo.label}`,
                    handler: handleArchive,
                    disabled: !canMutateTodos,
                    class: 'hover:text-secondary',
                    title: !canMutateTodos ? (mutateTodoDisabledReason ?? undefined) : undefined,
                  },
                ]"
                type="button"
                :key="action.label"
                :disabled="action.disabled"
                :aria-label="action.label"
                :title="action.title"
                class="inline-flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-[background-color,color,transform] duration-150 hover:bg-surface-container-highest active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:size-10"
                :class="action.class"
                @click="action.handler(todo)"
              >
                <component :is="action.icon" class="size-4" stroke-width="1.8" aria-hidden="true" />
                <span class="sr-only">{{ action.label }}</span>
              </button>
            </template>
          </TodoItem>
        </li>
      </ul>
    </div>
  </div>
</template>
