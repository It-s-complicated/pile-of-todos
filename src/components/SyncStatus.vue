<script setup lang="ts">
import { RefreshCcw } from 'lucide-vue-next'
import { computed } from 'vue'

import { useElectricTodos } from '@/composables/useElectricTodos'
import { useTodoSync } from '@/composables/useTodoSync'

const { isOnline, statuses } = useElectricTodos()
const { canRetrySync, queuedCreateCount, syncTodos } = useTodoSync()

const statusConfig = computed(() => {
  if (statuses.degraded.value === 'requires-reauth') {
    return {
      dotClass: 'bg-error',
      text: 'Re-auth required',
      textClass: 'text-error',
    }
  }

  if (statuses.degraded.value === 'retryable-error') {
    return {
      dotClass: 'bg-secondary',
      text: 'Retry pending',
      textClass: 'text-secondary',
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
      dotClass: 'bg-on-surface-variant',
      text: 'Paused',
      textClass: 'text-on-surface-variant',
    }
  }

  return {
    dotClass: 'bg-primary',
    text: 'Synced',
    textClass: 'text-primary',
  }
})
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container/80 px-3 py-2 text-xs shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
  >
    <div
      class="size-2 rounded-full transition-colors duration-200"
      :class="statusConfig.dotClass"
    />
    <span class="font-semibold tracking-looser uppercase" :class="statusConfig.textClass">
      {{ statusConfig.text }}
    </span>
    <button
      v-if="canRetrySync"
      class="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2.5 py-1 text-tiny font-semibold tracking-looser text-on-surface uppercase transition-colors hover:bg-surface-bright"
      @click="syncTodos"
    >
      <RefreshCcw class="size-3" stroke-width="2" aria-hidden />
      <span>Retry</span>
    </button>
  </div>
</template>
