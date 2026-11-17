<script setup lang="ts">
import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useLane } from '@/composables/useLanes'

const finished = useLane('finished')
</script>

<template>
  <TodoList :todos="finished" show-schedule>
    <template #empty>
      <TodoListEmpty
        title="No completed tasks"
        subtitle="Tasks you check off show up here, most recent first, until you archive them."
      />
    </template>
  </TodoList>
</template>
