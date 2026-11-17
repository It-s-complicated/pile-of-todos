<script setup lang="ts">
import { computed } from 'vue'

import TodoList from '@/components/TodoList.vue'
import TodoListEmpty from '@/components/TodoListEmpty.vue'
import { useCurrentWeek } from '@/composables/useCurrentWeek'
import { useLane } from '@/composables/useLanes'
import { useTodoActions } from '@/composables/useTodoActions'
import { groupByWeek } from '@/lib/lanes'

const unfinished = useLane('unfinished')
const currentWeek = useCurrentWeek()
const { moveMany } = useTodoActions()

const groups = computed(() =>
  groupByWeek(unfinished.value, currentWeek.value, 'desc').map((group) => ({
    ...group,
    action:
      group.todos.length > 1
        ? { label: 'Move all to this week', run: () => moveMany(group.todos, currentWeek.value) }
        : null,
  })),
)
</script>

<template>
  <TodoList :groups="groups">
    <template #empty>
      <TodoListEmpty
        title="All caught up"
        subtitle="Open tasks from past weeks land here so you can finish, reschedule, or let them go."
      />
    </template>
  </TodoList>
</template>
