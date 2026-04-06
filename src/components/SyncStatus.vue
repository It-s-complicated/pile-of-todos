<script setup lang="ts">
import { computed } from 'vue'

import { useElectricTodos } from '@/composables/useElectricTodos'
import { useTodoSync } from '@/composables/useTodoSync'

const { isOnline, statuses } = useElectricTodos()
const { canRetrySync, queuedCreateCount, syncTodos } = useTodoSync()

const statusConfig = computed(() => {
  if (statuses.degraded.value === 'requires-reauth') {
    return {
      dotClass: 'bg-red-500',
      text: 'Re-auth required',
      textClass: 'text-red-600',
    }
  }

  if (statuses.degraded.value === 'retryable-error') {
    return {
      dotClass: 'bg-amber-500',
      text: 'Retry queued',
      textClass: 'text-amber-700',
    }
  }

  if (statuses.sync.value === 'queued-offline') {
    return {
      dotClass: 'bg-amber-500',
      text: `${queuedCreateCount.value} queued offline`,
      textClass: 'text-amber-700',
    }
  }

  if (statuses.sync.value === 'syncing') {
    return {
      dotClass: 'bg-blue-500 animate-pulse',
      text: 'Syncing queued tasks',
      textClass: 'text-blue-600',
    }
  }

  if (!isOnline.value) {
    return {
      dotClass: 'bg-gray-400',
      text: 'Offline',
      textClass: 'text-gray-500',
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
    text: 'Live',
    textClass: 'text-green-600',
  }
})
</script>

<template>
  <div class="flex items-center gap-2 text-xs">
    <div
      class="size-2 rounded-full transition-colors duration-200"
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
