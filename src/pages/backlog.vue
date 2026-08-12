<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useTodos } from '@/composables/useTodos'

const { todos } = useTodos()
const filteredTodos = computed(() =>
  todos.value.filter(
    (todo) => todo.deletedAt === null && todo.weekNumber === null && !todo.archived,
  ),
)
</script>

<template>
  <TodoList :todos="filteredTodos">
    <template #empty>
      <TodoListEmpty
        title="Backlog is empty"
        subtitle="Use this lane for tasks you want to keep, but have not scheduled yet."
      />
    </template>
  </TodoList>
</template>
