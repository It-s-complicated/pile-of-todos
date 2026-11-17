<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useCurrentWeek } from '@/composables/useCurrentWeek'
import { useLane } from '@/composables/useLanes'
import { groupByWeek } from '@/lib/lanes'

const future = useLane('future')
const currentWeek = useCurrentWeek()
const groups = computed(() => groupByWeek(future.value, currentWeek.value, 'asc'))
</script>

<template>
  <TodoList :groups="groups">
    <template #empty>
      <TodoListEmpty
        title="No future-week tasks"
        subtitle="Schedule something for a later week and it waits here until its week arrives."
      />
    </template>
  </TodoList>
</template>
