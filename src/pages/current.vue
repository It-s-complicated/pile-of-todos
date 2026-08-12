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
    (todo) => todo.deletedAt === null && todo.weekNumber === currentWeek && !todo.archived,
  ),
)
</script>

<template>
  <TodoList :todos="filteredTodos">
    <template #empty>
      <TodoListEmpty
        title="No tasks for this week"
        subtitle="This lane holds the work you plan to finish before the week closes."
      />
    </template>
  </TodoList>
</template>
