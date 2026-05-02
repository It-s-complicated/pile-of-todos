<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useElectricTodos } from '@/composables/useElectricTodos'

const { todos } = useElectricTodos()
const filteredTodos = computed(() =>
  todos.value.filter((todo) => todo.deletedAt === null && todo.done && !todo.archived),
)
</script>

<template>
  <TodoList :todos="filteredTodos">
    <template #empty>
      <TodoListEmpty
        title="No completed tasks"
        subtitle="Tasks you mark done appear here before you archive them."
      />
    </template>
  </TodoList>
</template>
