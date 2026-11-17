<script setup lang="ts">
import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useLane } from '@/composables/useLanes'

const backlog = useLane('backlog')
</script>

<template>
  <TodoList :todos="backlog">
    <template #empty>
      <TodoListEmpty
        title="Backlog is empty"
        subtitle="Park ideas and someday-tasks here. Pull them into a week when they matter."
      />
    </template>
  </TodoList>
</template>
