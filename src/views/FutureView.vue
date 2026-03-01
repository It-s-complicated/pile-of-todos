<script setup lang="ts">
import TodoList from '../components/TodoList.vue'
</script>

<template>
  <div class="mb-6">
    <h2 class="mb-2 font-[Playfair_Display] text-2xl font-semibold text-navy">Future Tasks</h2>
    <p class="text-sm text-text-muted">Tasks scheduled for upcoming weeks</p>
  </div>
  <TodoList />
</template>
