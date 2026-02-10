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
  <div class="bg-white rounded-xl shadow-lg p-6 max-w-md w-full animate-fade-in-up">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="font-[Playfair_Display] text-xl font-semibold text-navy">
          Move to Week
        </h3>
        <p class="text-sm text-text-muted mt-1">
          Select a destination for this task
        </p>
      </div>
      <button
        type="button"
        class="p-2 text-text-muted hover:text-navy hover:bg-cream rounded-lg transition-all duration-150"
        @click="cancel"
      >
        <X class="size-5" stroke-width="1.5" />
      </button>
    </div>

    <!-- Week Options -->
    <div class="space-y-2 mb-6">
      <button
        v-for="option in weekOptions"
        :key="option.value ?? 'backlog'"
        type="button"
        class="w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left"
        :class="
          selectedWeek === option.value
            ? 'border-coral bg-cream'
            : 'border-border bg-white hover:border-border-hover hover:bg-cream'
        "
        @click="selectedWeek = option.value"
      >
        <div
          class="size-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
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
        class="flex-1 px-4 py-2.5 bg-coral text-white rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 hover:bg-coral-dark hover:shadow-md active:scale-[0.98]"
        @click="confirm"
      >
        Move Task
      </button>
      <button
        type="button"
        class="px-4 py-2.5 bg-cream text-text-secondary rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 hover:bg-border active:scale-[0.98]"
        @click="cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
