<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div
    class="rounded-3xl border border-outline-variant/10 bg-surface-container/70 px-6 py-16 text-center shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
  >
    <div class="inline-flex flex-col items-center gap-4">
      <div
        class="flex size-16 items-center justify-center rounded-full bg-surface-container-highest text-primary"
      >
        <Inbox class="size-8" stroke-width="1.5" aria-hidden />
      </div>
      <div>
        <p class="font-headline text-lg font-semibold tracking-tight text-on-surface">
          {{ title }}
        </p>
        <p class="mt-2 text-sm text-on-surface-variant">
          {{ subtitle }}
        </p>
      </div>
    </div>
  </div>
</template>
