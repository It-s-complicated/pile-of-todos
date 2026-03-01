<script setup lang="ts">
import TodoList from '../components/TodoList.vue'
</script>

<template>
  <div class="mb-6">
    <h2 class="mb-2 font-[Playfair_Display] text-2xl font-semibold text-navy">Unfinished</h2>
    <p class="text-sm text-text-muted">Past week tasks that still need attention</p>
  </div>
  <TodoList />
</template>
