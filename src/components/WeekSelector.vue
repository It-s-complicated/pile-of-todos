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
  <div class="animate-fade-in-up w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h3 class="font-[Playfair_Display] text-xl font-semibold text-navy">Move to Week</h3>
        <p class="mt-1 text-sm text-text-muted">Select a destination for this task</p>
      </div>
      <button
        type="button"
        class="rounded-lg p-2 text-text-muted transition-all duration-150 hover:bg-cream hover:text-navy"
        @click="cancel"
      >
        <X class="size-5" stroke-width="1.5" />
      </button>
    </div>

    <!-- Week Options -->
    <div class="mb-6 space-y-2">
      <button
        v-for="option in weekOptions"
        :key="option.value ?? 'backlog'"
        type="button"
        class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200"
        :class="
          selectedWeek === option.value
            ? 'border-coral bg-cream'
            : 'border-border bg-white hover:border-border-hover hover:bg-cream'
        "
        @click="selectedWeek = option.value"
      >
        <div
          class="flex size-5 items-center justify-center rounded-full border-2 transition-all duration-200"
          :class="selectedWeek === option.value ? 'border-coral bg-coral' : 'border-border'"
        >
          <div v-if="selectedWeek === option.value" class="size-2 rounded-full bg-white" />
        </div>
        <div class="flex-1">
          <p class="font-medium text-navy">
            {{ option.label }}
          </p>
          <p class="text-xs text-text-muted">
            {{ option.description }}
          </p>
        </div>
      </button>
    </div>

    <!-- Actions -->
    <div class="flex gap-3">
      <button
        type="button"
        class="flex-1 cursor-pointer rounded-lg bg-coral px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-coral-dark hover:shadow-md active:scale-[0.98]"
        @click="confirm"
      >
        Move Task
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg bg-cream px-4 py-2.5 text-sm font-medium text-text-secondary transition-all duration-150 hover:bg-border active:scale-[0.98]"
        @click="cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
