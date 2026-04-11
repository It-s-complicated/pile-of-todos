<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import { useElectricTodos } from '@/composables/useElectricTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

const { todos } = useElectricTodos()
const currentWeek = getCurrentWeekNumber()
const filteredTodos = computed(() =>
  todos.value.filter(
    (todo) => todo.deletedAt === null && todo.weekNumber === currentWeek && !todo.archived,
  ),
)
</script>

<template>
  <TodoList filter="current-week" :todos="filteredTodos">
    <template #empty>
      <TodoItemEmpty title="No tasks this week" subtitle="Add tasks for the current week." />
    </template>
  </TodoList>
</template>
