<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import { useElectricTodos } from '@/composables/useElectricTodos'

const { todos } = useElectricTodos()
const filteredTodos = computed(() =>
  todos.value.filter((todo) => todo.deletedAt === null && todo.archived),
)
</script>

<template>
  <TodoList filter="archived" :todos="filteredTodos">
    <template #empty>
      <TodoListEmpty
        title="No archived tasks"
        subtitle="Archive tasks to hide them from active views."
      />
    </template>
  </TodoList>
</template>
