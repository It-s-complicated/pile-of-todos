<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useElectricTodos } from '@/composables/useElectricTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

const { todos } = useElectricTodos()
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
      <TodoListEmpty title="No unfinished tasks" subtitle="All past tasks are complete!" />
    </template>
  </TodoList>
</template>
