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
      class="week-select w-full cursor-pointer appearance-none rounded-2xl border border-outline-variant/10 bg-surface-container-highest bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a8abb0%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat px-4 pr-10 text-on-surface transition-all duration-200 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      :class="variant === 'compact' ? 'min-h-10 py-2 text-caption' : 'min-h-11 py-3 text-control'"
    >
      <button>
        <selectedcontent />
      </button>
      <option v-for="option in options" :key="option.value || 'backlog'" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="showHelper" class="mt-2 text-caption leading-5 text-on-surface-variant">
      New tasks go to the selected lane.
    </p>
  </div>
</template>

<style scoped>
.week-select {
  color-scheme: dark;
}

.week-select option {
  background-color: var(--color-surface-container-highest);
  color: var(--color-on-surface);
}

@supports (appearance: base-select) {
  .week-select,
  .week-select::picker(select) {
    appearance: base-select;
  }

  .week-select {
    background-image: none;
    inline-size: 100%;
    padding-inline: 1rem 0.7rem;
  }

  .week-select:open {
    border-color: color-mix(in srgb, var(--color-primary) 46%, transparent);
    box-shadow: 0 0 0 2px rgb(184 203 193 / 0.14);
  }

  .week-select::picker-icon {
    color: var(--color-on-surface-variant);
    transition:
      rotate 180ms cubic-bezier(0.16, 1, 0.3, 1),
      color 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .week-select:hover::picker-icon,
  .week-select:open::picker-icon {
    color: var(--color-primary);
  }

  .week-select:open::picker-icon {
    rotate: 180deg;
  }

  .week-select::picker(select) {
    min-inline-size: anchor-size(width);
    margin-block-start: 0.35rem;
    border: 1px solid color-mix(in srgb, var(--color-outline) 34%, transparent);
    border-radius: 0.875rem;
    background: linear-gradient(
      180deg,
      var(--color-surface-container-highest) 0%,
      var(--color-surface-container-high) 100%
    );
    box-shadow: var(--shadow-overlay);
    padding: 0.3rem;
  }

  .week-select button {
    display: contents;
  }

  .week-select selectedcontent {
    display: inline-flex;
    min-inline-size: 0;
    align-items: center;
  }

  .week-select option {
    display: grid;
    grid-template-columns: 1rem minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    min-block-size: 2.25rem;
    border-radius: 0.625rem;
    padding: 0.5rem 0.7rem;
    background-color: transparent;
    color: var(--color-on-surface);
    font-size: 0.8125rem;
    line-height: 1.125rem;
    transition:
      background-color 160ms cubic-bezier(0.16, 1, 0.3, 1),
      color 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .week-select option::checkmark {
    content: '';
    inline-size: 0.46rem;
    block-size: 0.46rem;
    border-radius: 9999px;
    background-color: currentColor;
    box-shadow: 0 0 0 3px rgb(184 203 193 / 0.14);
  }

  .week-select option:not(:checked)::checkmark {
    opacity: 0;
  }

  .week-select option:hover,
  .week-select option:focus {
    background-color: color-mix(in srgb, var(--color-primary-container) 34%, transparent);
    color: var(--color-on-primary-container);
  }

  .week-select option:checked {
    background-color: color-mix(in srgb, var(--color-primary-container) 62%, transparent);
    color: var(--color-on-primary-container);
  }

  .week-select option:disabled {
    color: color-mix(in srgb, var(--color-on-surface-variant) 52%, transparent);
  }
}
</style>
