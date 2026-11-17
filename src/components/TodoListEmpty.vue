<script setup lang="ts">
import { Inbox } from '@lucide/vue'

defineProps<{
  link?: { label: string; to: string } | null
  subtitle: string
  title: string
}>()
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
      </div>
      <RouterLink
        v-if="link"
        :to="link.to"
        class="inline-flex min-h-10 items-center rounded-full border border-outline-variant/15 px-4 text-control font-semibold text-primary transition-colors duration-150 hover:bg-primary/10"
      >
        {{ link.label }}
      </RouterLink>
    </div>
  </div>
</template>
