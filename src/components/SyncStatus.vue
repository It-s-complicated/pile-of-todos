<script setup lang="ts">
import { computed } from 'vue'
import { useElectricTodos } from '@/composables/useElectricTodos'

const { isOnline, isMigrating, syncStatus, localTodosCount, needsMigration, migrateLocalTodos } =
  useElectricTodos()

const statusConfig = computed(() => {
  if (!isOnline.value) {
    return {
      dotClass: 'bg-red-500',
      text: 'Offline',
      textClass: 'text-red-600',
    }
  }
  if (isMigrating.value) {
    return {
      dotClass: 'bg-yellow-500 animate-pulse',
      text: 'Migrating...',
      textClass: 'text-yellow-600',
    }
  }
  if (syncStatus.value === 'syncing') {
    return {
      dotClass: 'bg-yellow-500 animate-pulse',
      text: 'Syncing...',
      textClass: 'text-yellow-600',
    }
  }
  if (syncStatus.value === 'error') {
    return {
      dotClass: 'bg-red-500',
      text: 'Sync error',
      textClass: 'text-red-600',
    }
  }
  if (syncStatus.value === 'local-only') {
    return {
      dotClass: 'bg-gray-400',
      text: 'Local only',
      textClass: 'text-gray-500',
    }
  }
  return {
    dotClass: 'bg-green-500',
    text: 'Synced',
    textClass: 'text-green-600',
  }
})
</script>

<template>
  <div class="flex items-center gap-2 text-xs">
    <div
      class="h-2 w-2 rounded-full transition-colors duration-200"
      :class="statusConfig.dotClass"
    />
    <span class="font-medium" :class="statusConfig.textClass">
      {{ statusConfig.text }}
    </span>
    <button
      v-if="needsMigration && !isMigrating"
      @click="migrateLocalTodos"
      class="ml-2 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-100"
    >
      Upload {{ localTodosCount }} local
    </button>
  </div>
</template>
