<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div
    class="rounded-3xl border border-outline-variant/10 bg-surface-container/60 px-5 py-8 text-center shadow-surface-rest sm:px-6 sm:py-10"
  >
    <div class="mx-auto flex max-w-sm flex-col items-center gap-4">
      <div
        class="flex size-14 items-center justify-center rounded-full border border-outline-variant/10 bg-surface-container-highest text-primary shadow-surface-rest"
      >
        <Inbox class="size-7" stroke-width="1.6" aria-hidden />
      </div>
      <div>
        <p class="font-headline text-title font-semibold text-on-surface">
          {{ title }}
        </p>
        <p class="mt-2 text-supporting text-on-surface-variant">
          {{ subtitle }}
        </p>
        <p class="mt-3 text-caption leading-5 text-on-surface-variant">
          Add a task from the composer below, then choose a week when it needs a home.
        </p>
      </div>
    </div>
  </div>
</template>
