<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import { useElectricTodos } from '@/composables/useElectricTodos'

const { todos } = useElectricTodos()
const filteredTodos = computed(() =>
  todos.value.filter(
    (todo) => todo.deletedAt === null && todo.weekNumber === null && !todo.archived,
  ),
)
</script>

<template>
  <TodoList filter="backlog" :todos="filteredTodos" />
</template>
