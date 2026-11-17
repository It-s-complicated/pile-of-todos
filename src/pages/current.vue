<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useLane } from '@/composables/useLanes'
import { countOpen } from '@/lib/lanes'

const current = useLane('current')
const backlog = useLane('backlog')
const unfinished = useLane('unfinished')

const unfinishedCount = computed(() => unfinished.value.length)
const emptyLink = computed(() => {
  const backlogCount = countOpen(backlog.value)
  return backlogCount > 0 ? { label: `Pick from backlog (${backlogCount})`, to: '/backlog' } : null
})
</script>

<template>
  <RouterLink
    v-if="unfinishedCount > 0"
    to="/unfinished"
    class="mb-4 flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 px-4 py-2 text-supporting text-on-surface-variant transition-colors duration-150 hover:border-outline-variant/20 hover:text-on-surface"
  >
    <span>
      {{ unfinishedCount === 1 ? '1 task' : `${unfinishedCount} tasks` }} from past weeks still open
    </span>
    <span class="shrink-0 text-caption font-semibold text-primary">Review →</span>
  </RouterLink>

  <TodoList :todos="current">
    <template #empty>
      <TodoListEmpty
        title="Nothing planned yet"
        subtitle="Add what you want to finish this week, or pull something in from the backlog."
        :link="emptyLink"
      />
    </template>
  </TodoList>
</template>
