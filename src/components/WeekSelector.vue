<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    currentWeek: number
    selectedWeek?: number | null
  }>(),
  {
    selectedWeek: null,
  },
)
const emit = defineEmits<{
  confirm: [weekNumber: number | null]
  cancel: []
}>()

const id = useId()
const selectedWeek = ref<number | null>(props.selectedWeek)

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
    role="dialog"
    aria-modal="true"
    :aria-labelledby="`${id}-title`"
    class="animate-fade-in-up max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-outline-variant/10 bg-surface-container/95 p-4 text-on-surface shadow-[0_20px_40px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:max-h-[calc(100vh-2rem)] sm:p-5"
  >
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h3
          :id="`${id}-title`"
          class="font-headline text-2xl font-extrabold tracking-tight text-on-surface"
        >
          Move to Week
        </h3>
        <p class="mt-1 text-sm text-on-surface-variant">Select a destination for this task</p>
      </div>
      <button
        type="button"
        aria-label="Close week selector"
        class="inline-flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-all duration-150 hover:bg-surface-container-highest hover:text-on-surface active:scale-95 sm:size-10"
        @click="cancel"
      >
        <X class="size-5" stroke-width="1.8" />
      </button>
    </div>

    <fieldset class="mb-6">
      <legend class="sr-only">Choose a destination week for this task</legend>

      <div class="space-y-2">
        <div v-for="option in weekOptions" :key="option.value ?? 'backlog'">
          <input
            :id="`${id}-week-${option.value ?? 'backlog'}`"
            v-model="selectedWeek"
            :value="option.value"
            :name="`${id}-week`"
            type="radio"
            class="peer sr-only"
          />
          <label
            :for="`${id}-week-${option.value ?? 'backlog'}`"
            class="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-container active:scale-[0.99]"
            :class="
              selectedWeek === option.value
                ? 'border-primary/30 bg-primary-container/20'
                : 'border-outline-variant/10 bg-surface-container-highest hover:border-outline-variant/20 hover:bg-surface-bright'
            "
          >
            <span
              class="flex size-5 items-center justify-center rounded-full border transition-all duration-200"
              :class="
                selectedWeek === option.value
                  ? 'border-primary bg-primary'
                  : 'border-outline-variant/50 bg-transparent'
              "
            >
              <span
                v-if="selectedWeek === option.value"
                class="size-2 rounded-full bg-on-primary"
              />
            </span>
            <span class="flex-1">
              <span class="block font-label text-sm font-semibold text-on-surface">
                {{ option.label }}
              </span>
              <span class="block text-xs text-on-surface-variant">
                {{ option.description }}
              </span>
            </span>
          </label>
        </div>
      </div>
    </fieldset>

    <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
      <button
        type="button"
        class="min-h-12 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold tracking-loose text-on-primary uppercase transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(184,203,193,0.18)] active:translate-y-0"
        @click="confirm"
      >
        Move Task
      </button>
      <button
        type="button"
        class="min-h-12 rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-4 py-3 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-bright"
        @click="cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
