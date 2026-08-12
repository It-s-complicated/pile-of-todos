<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useTodos } from '@/composables/useTodos'

const { todos } = useTodos()
const filteredTodos = computed(() =>
  todos.value.filter((todo) => todo.deletedAt === null && todo.archived),
)
</script>

<template>
  <TodoList :todos="filteredTodos">
    <template #empty>
      <TodoListEmpty
        title="No archived tasks"
        subtitle="Archived tasks are hidden from active planning lanes and collected here."
      />
    </template>
  </TodoList>
</template>
