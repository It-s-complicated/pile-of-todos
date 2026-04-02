<script setup lang="ts">
import { computed } from 'vue'
import { useSyncElectricTodos } from '@/composables/useSyncElectricTodos'

const { canRetrySync, statuses, syncTodos } = useSyncElectricTodos()

const statusConfig = computed(() => {
  if (statuses.migration.value === 'legacy-guest-pending') {
    return {
      dotClass: 'bg-amber-500',
      text: 'Migration pending',
      textClass: 'text-amber-700',
    }
  }

  if (statuses.degraded.value === 'requires-reauth') {
    return {
      dotClass: 'bg-red-500',
      text: 'Re-auth required',
      textClass: 'text-red-600',
    }
  }

  if (statuses.degraded.value === 'invariant-violation') {
    return {
      dotClass: 'bg-red-500',
      text: 'Sync degraded',
      textClass: 'text-red-600',
    }
  }

  if (statuses.degraded.value === 'retryable-error') {
    return {
      dotClass: 'bg-amber-500',
      text: 'Retry pending',
      textClass: 'text-amber-700',
    }
  }

  if (statuses.sync.value === 'syncing') {
    return {
      dotClass: 'bg-yellow-500 animate-pulse',
      text: 'Syncing...',
      textClass: 'text-yellow-600',
    }
  }

  if (statuses.sync.value === 'paused') {
    return {
      dotClass: 'bg-gray-400',
      text: 'Paused',
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
      v-if="canRetrySync"
      class="ml-2 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-100"
      @click="syncTodos"
    >
      Retry sync
    </button>
  </div>
</template>
