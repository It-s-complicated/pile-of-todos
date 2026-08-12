<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useTodos } from '@/composables/useTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

const { todos } = useTodos()
const currentWeek = getCurrentWeekNumber()
const filteredTodos = computed(() =>
  todos.value.filter(
    (todo) =>
      todo.deletedAt === null &&
      todo.weekNumber !== null &&
      todo.weekNumber < currentWeek &&
      !todo.done &&
      !todo.archived,
  ),
)
</script>

<template>
  <TodoList :todos="filteredTodos">
    <template #empty>
      <TodoListEmpty
        title="No unfinished tasks"
        subtitle="Incomplete tasks from past weeks appear here for review and rescheduling."
      />
    </template>
  </TodoList>
</template>
