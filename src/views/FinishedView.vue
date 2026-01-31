<script setup lang="ts">
import TodoList from '../components/TodoList.vue'
</script>

<template>
  <div class="mb-6">
    <h2 class="font-[Playfair_Display] text-2xl font-semibold text-navy mb-2">
      Completed
    </h2>
    <p class="text-sm text-text-muted">
      Tasks that have been checked off
    </p>
  </div>
  <TodoList />
</template>
