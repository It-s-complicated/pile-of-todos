<script setup lang="ts">
import { X } from '@lucide/vue'

import { useToast } from '@/composables/useToast'

const { dismiss, hold, release, toast } = useToast()
</script>

<template>
  <div class="pointer-events-none flex justify-center" aria-live="polite" aria-atomic="true">
    <Transition
      mode="out-in"
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast"
        :key="toast.id"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        class="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border py-1 pr-1 pl-4 text-supporting shadow-floating backdrop-blur-2xl"
        :class="
          toast.tone === 'error'
            ? 'border-error/25 bg-error-container/80 text-on-error-container'
            : 'border-outline-variant/15 bg-surface-container-highest/95 text-on-surface'
        "
        @mouseenter="hold"
        @mouseleave="release"
        @focusin="hold"
        @focusout="release"
      >
        <span class="min-w-0 truncate py-1.5 pr-1">{{ toast.message }}</span>
        <button
          v-if="toast.action"
          type="button"
          class="min-h-9 shrink-0 rounded-full px-3 text-control font-semibold text-primary transition-colors duration-150 hover:bg-primary/10"
          @click="toast.action.run()"
        >
          {{ toast.action.label }}
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-150 hover:bg-surface-bright/60 hover:text-on-surface"
          @click="dismiss"
        >
          <X class="size-4" stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>
