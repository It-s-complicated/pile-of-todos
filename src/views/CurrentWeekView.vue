<script setup lang="ts">
import { computed } from 'vue'
import TodoList from '@/components/TodoList.vue'
import { useWeekNumber } from '@/composables/useWeekNumber'

const { getCurrentWeekNumber } = useWeekNumber()
const currentWeek = computed(() => getCurrentWeekNumber())
</script>

<template>
  <div class="mb-6">
    <h2 class="mb-2 font-[Playfair_Display] text-2xl font-semibold text-navy">Current Week</h2>
    <p class="font-mono text-sm text-text-muted">Week {{ currentWeek }} · Tasks for this week</p>
  </div>
  <TodoList />
</template>
