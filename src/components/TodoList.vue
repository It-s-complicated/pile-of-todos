<script setup lang="ts">
import { computed } from 'vue'

import type { Todo } from '@/db/collections'
import { useTodos } from '@/composables/useTodos'
import type { TodoGroup } from '@/lib/lanes'

import TodoItem from './TodoItem.vue'

export type TodoListGroup = Omit<TodoGroup, 'weekNumber'> & {
  action?: { label: string; run: () => void } | null
}

const props = withDefaults(
  defineProps<{
    groups?: TodoListGroup[] | null
    showSchedule?: boolean
    todos?: Todo[]
  }>(),
  {
    groups: null,
    showSchedule: false,
    todos: () => [],
  },
)

const { canMutateTodos, isReady, mutateTodoDisabledReason } = useTodos()

const loading = computed(() => !isReady.value)
const sections = computed<TodoListGroup[]>(
  () => props.groups ?? [{ id: 'all', title: '', meta: null, todos: props.todos }],
)
const isEmpty = computed(() => sections.value.every((section) => section.todos.length === 0))
</script>

<template>
  <div v-if="loading" class="space-y-2" aria-busy="true" aria-live="polite">
    <p class="sr-only">Loading tasks...</p>
    <div
      v-for="index in 4"
      :key="index"
      class="flex animate-pulse items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container px-3 py-3.5"
    >
      <div class="size-6 rounded-full border border-outline-variant/30" />
      <div
        class="h-4 rounded-full bg-surface-bright/60"
        :style="{ width: `${80 - index * 12}%` }"
      />
    </div>
  </div>

  <slot v-else-if="isEmpty" name="empty" />

  <div v-else class="space-y-7">
    <section
      v-for="section in sections"
      :key="section.id"
      :aria-labelledby="section.title ? `group-${section.id}` : undefined"
    >
      <header
        v-if="section.title"
        class="mb-2.5 flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1"
      >
        <h2 :id="`group-${section.id}`" class="flex items-baseline gap-2">
          <span class="font-headline text-title font-semibold text-on-surface">
            {{ section.title }}
          </span>
          <span v-if="section.meta" class="text-caption text-on-surface-variant">
            {{ section.meta }}
          </span>
          <span class="text-caption text-on-surface-variant/70">· {{ section.todos.length }}</span>
        </h2>
        <button
          v-if="section.action && canMutateTodos"
          type="button"
          class="inline-flex min-h-9 items-center rounded-full border border-outline-variant/15 px-3 text-caption font-semibold text-on-surface-variant transition-[background-color,color,border-color] duration-150 hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
          @click="section.action.run()"
        >
          {{ section.action.label }}
        </button>
      </header>

      <ul role="list" class="flex flex-col gap-2">
        <li
          v-for="(todo, index) in section.todos"
          :id="todo.id"
          :key="todo.id"
          :style="{ '--staggered-animation-delay': `${Math.min(index * 30, 300)}ms` }"
          class="animate-fade-in-up animation-delay-(--staggered-animation-delay)"
        >
          <TodoItem
            :can-mutate="canMutateTodos"
            :mutate-disabled-reason="mutateTodoDisabledReason"
            :show-schedule="showSchedule"
            :todo="todo"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
