<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div
    class="rounded-3xl border border-outline-variant/10 bg-surface-container/70 px-5 py-12 text-center shadow-surface-rest sm:px-6 sm:py-16"
  >
    <div class="inline-flex flex-col items-center gap-4">
      <div
        class="flex size-16 items-center justify-center rounded-full bg-surface-container-highest text-primary"
      >
        <Inbox class="size-8" stroke-width="1.5" aria-hidden />
      </div>
      <div>
        <p class="font-headline text-title font-semibold tracking-tight text-on-surface">
          {{ title }}
        </p>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-on-surface-variant">
          {{ subtitle }}
        </p>
      </div>
    </div>
  </div>
</template>
