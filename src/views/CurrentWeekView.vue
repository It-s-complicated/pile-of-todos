<script setup lang="ts">
import { computed } from 'vue'
import TodoList from '../components/TodoList.vue'
import { useWeekNumber } from '../composables/useWeekNumber'

const { getCurrentWeekNumber } = useWeekNumber()
const currentWeek = computed(() => getCurrentWeekNumber())
</script>

<template>
  <div class="p-4">
    <h1 class="text-3xl font-bold mb-6 text-gray-900">
      Current Week (Week {{ currentWeek }})
    </h1>
    <TodoList />
  </div>
</template>
