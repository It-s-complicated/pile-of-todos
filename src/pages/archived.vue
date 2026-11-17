<script setup lang="ts">
import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useLane } from '@/composables/useLanes'

const archived = useLane('archived')
</script>

<template>
  <TodoList :todos="archived" show-schedule>
    <template #empty>
      <TodoListEmpty
        title="No archived tasks"
        subtitle="Archived tasks leave your planning lanes and rest here. Restore one any time."
      />
    </template>
  </TodoList>
</template>
