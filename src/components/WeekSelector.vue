<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps<{ currentWeek: number }>()
const emit = defineEmits<{
  confirm: [weekNumber: number | null]
  cancel: []
}>()

const selectedWeek = ref<number | null>(null)

function confirm() {
  emit('confirm', selectedWeek.value)
}

function cancel() {
  emit('cancel')
}

const weekOptions = [
  { value: null, label: 'Backlog', description: 'No assigned week' },
  {
    value: props.currentWeek - 1,
    label: `Week ${props.currentWeek - 1}`,
    description: 'Previous week',
  },
  { value: props.currentWeek, label: `Week ${props.currentWeek}`, description: 'Current week' },
  {
    value: props.currentWeek + 1,
    label: `Week ${props.currentWeek + 1}`,
    description: 'Next week',
  },
  {
    value: props.currentWeek + 2,
    label: `Week ${props.currentWeek + 2}`,
    description: 'Two weeks ahead',
  },
  {
    value: props.currentWeek + 3,
    label: `Week ${props.currentWeek + 3}`,
    description: 'Three weeks ahead',
  },
]
</script>

<template>
  <div
    class="animate-fade-in-up w-full max-w-md rounded-[1.5rem] border border-outline-variant/10 bg-surface-container/95 p-5 text-on-surface shadow-[0_20px_40px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
  >
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h3 class="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
          Move to Week
        </h3>
        <p class="mt-1 text-sm text-on-surface-variant">Select a destination for this task</p>
      </div>
      <button
        type="button"
        class="rounded-full p-2 text-on-surface-variant transition-all duration-150 hover:bg-surface-container-highest hover:text-on-surface"
        @click="cancel"
      >
        <X class="size-5" stroke-width="1.8" />
      </button>
    </div>

    <div class="mb-6 space-y-2">
      <button
        v-for="option in weekOptions"
        :key="option.value ?? 'backlog'"
        type="button"
        class="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200"
        :class="
          selectedWeek === option.value
            ? 'border-primary/30 bg-primary-container/20'
            : 'border-outline-variant/10 bg-surface-container-highest hover:border-outline-variant/20 hover:bg-surface-bright'
        "
        @click="selectedWeek = option.value"
      >
        <div
          class="flex size-5 items-center justify-center rounded-full border transition-all duration-200"
          :class="
            selectedWeek === option.value
              ? 'border-primary bg-primary'
              : 'border-outline-variant/50 bg-transparent'
          "
        >
          <div v-if="selectedWeek === option.value" class="size-2 rounded-full bg-on-primary" />
        </div>
        <div class="flex-1">
          <p class="font-label text-sm font-semibold text-on-surface">
            {{ option.label }}
          </p>
          <p class="text-xs text-on-surface-variant">
            {{ option.description }}
          </p>
        </div>
      </button>
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        class="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold tracking-[0.18em] text-on-primary uppercase transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(184,203,193,0.18)]"
        @click="confirm"
      >
        Move Task
      </button>
      <button
        type="button"
        class="rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-4 py-3 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-bright"
        @click="cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
