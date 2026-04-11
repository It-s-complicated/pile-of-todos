<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import { useElectricTodos } from '@/composables/useElectricTodos'

const { todos } = useElectricTodos()
const filteredTodos = computed(() =>
  todos.value.filter((todo) => todo.deletedAt === null && todo.done && !todo.archived),
)
</script>

<template>
  <TodoList filter="finished" :todos="filteredTodos">
    <template #empty>
      <TodoItemEmpty title="No completed tasks" subtitle="Mark tasks as done to see them here." />
    </template>
  </TodoList>
</template>
