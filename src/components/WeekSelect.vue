<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    currentWeek: number
    disabled?: boolean
    id?: string
    label?: string
    modelValue: number | null
    showHelper?: boolean
    variant?: 'compact' | 'full'
  }>(),
  {
    disabled: false,
    id: undefined,
    label: 'Week',
    showHelper: false,
    variant: 'full',
  },
)

const emit = defineEmits<{
  'update:modelValue': [weekNumber: number | null]
}>()

const generatedId = useId()
const selectId = computed(() => props.id ?? generatedId)
const options = computed(() => [
  { value: '', label: 'Backlog' },
  { value: String(props.currentWeek), label: `Week ${props.currentWeek} (current)` },
  { value: String(props.currentWeek + 1), label: `Week ${props.currentWeek + 1}` },
  { value: String(props.currentWeek + 2), label: `Week ${props.currentWeek + 2}` },
  { value: String(props.currentWeek + 3), label: `Week ${props.currentWeek + 3}` },
])

const selectedValue = computed({
  get: () => (props.modelValue === null ? '' : String(props.modelValue)),
  set: (value: string) => {
    emit('update:modelValue', value === '' ? null : Number(value))
  },
})
</script>

<template>
  <div :class="variant === 'compact' ? 'min-w-36' : 'w-full max-w-56'">
    <label
      :for="selectId"
      :class="[
        'mb-1.5 block text-tiny font-semibold tracking-label-wider text-on-surface-variant uppercase',
        variant === 'compact' ? 'sr-only' : '',
      ]"
    >
      {{ label }}
    </label>
    <select
      :id="selectId"
      v-model="selectedValue"
      :disabled="disabled"
      :aria-label="variant === 'compact' ? label : undefined"
      class="w-full cursor-pointer appearance-none rounded-2xl border border-outline-variant/10 bg-surface-container-highest bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a8abb0%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat px-4 pr-10 text-on-surface transition-all duration-200 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      :class="variant === 'compact' ? 'min-h-10 py-2 text-caption' : 'min-h-11 py-3 text-control'"
    >
      <option v-for="option in options" :key="option.value || 'backlog'" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="showHelper" class="mt-2 text-caption leading-5 text-on-surface-variant">
      New tasks go to the selected lane.
    </p>
  </div>
</template>
