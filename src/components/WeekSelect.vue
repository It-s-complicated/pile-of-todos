<script setup lang="ts">
import { computed, useId } from 'vue'

import { useCurrentWeek } from '@/composables/useCurrentWeek'
import { addWeeks, formatRelativeWeek, formatWeekRange, weekStart, type WeekKey } from '@/lib/weeks'

const UPCOMING_WEEKS = 12
const BACKLOG_VALUE = 'backlog'
const PLACEHOLDER_VALUE = ''

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    id?: string
    label?: string
    modelValue: WeekKey | null
    showHelper?: boolean
    /** `compact` renders a "Move to…" picker that marks the current week instead of showing it. */
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
  'update:modelValue': [weekNumber: WeekKey | null]
}>()

const currentWeek = useCurrentWeek()
const generatedId = useId()
const selectId = computed(() => props.id ?? generatedId)
const shortDate = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function weekOptionLabel(weekNumber: WeekKey) {
  const name = formatRelativeWeek(weekNumber, currentWeek.value)
  // Named weeks get their date range; numbered weeks just need the Monday.
  return name.startsWith('Week')
    ? `${name} · ${shortDate.format(weekStart(weekNumber))}`
    : `${name} · ${formatWeekRange(weekNumber)}`
}

const options = computed(() => {
  const weeks: WeekKey[] = Array.from({ length: UPCOMING_WEEKS + 1 }, (_, offset) =>
    addWeeks(currentWeek.value, offset),
  )

  // A task can sit in a past or far-future week; keep it selectable so the picker never goes blank.
  if (props.modelValue !== null && !weeks.includes(props.modelValue)) {
    weeks.push(props.modelValue)
    weeks.sort((left, right) => left - right)
  }

  return [
    { value: BACKLOG_VALUE, label: 'Backlog', weekNumber: null },
    ...weeks.map((weekNumber) => ({
      value: String(weekNumber),
      label: weekOptionLabel(weekNumber),
      weekNumber,
    })),
  ].map((option) => {
    const isCurrent = option.weekNumber === props.modelValue
    return {
      ...option,
      disabled: props.variant === 'compact' && isCurrent,
      label: props.variant === 'compact' && isCurrent ? `${option.label} (now)` : option.label,
    }
  })
})

function toValue(weekNumber: WeekKey | null) {
  return weekNumber === null ? BACKLOG_VALUE : String(weekNumber)
}

const selectedValue = computed(() =>
  props.variant === 'compact' ? PLACEHOLDER_VALUE : toValue(props.modelValue),
)

function handleChange(event: Event) {
  const select = event.target as HTMLSelectElement
  const value = select.value

  if (value === PLACEHOLDER_VALUE) {
    return
  }

  emit('update:modelValue', value === BACKLOG_VALUE ? null : Number(value))

  if (props.variant === 'compact') {
    // The compact picker is an action, not a field: reset it after moving.
    select.value = PLACEHOLDER_VALUE
  }
}
</script>

<template>
  <div :class="variant === 'compact' ? 'w-32 shrink-0' : 'w-full max-w-64'">
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
      :value="selectedValue"
      :disabled="disabled"
      :aria-label="variant === 'compact' ? label : undefined"
      class="week-select w-full cursor-pointer appearance-none rounded-2xl border border-outline-variant/10 bg-surface-container-highest bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a8abb0%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat px-4 pr-10 text-on-surface transition-all duration-200 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      :class="
        variant === 'compact'
          ? 'min-h-9 bg-surface-container-high py-1.5 text-caption text-on-surface-variant'
          : 'min-h-11 py-3 text-control'
      "
      @change="handleChange"
    >
      <option v-if="variant === 'compact'" :value="PLACEHOLDER_VALUE" disabled hidden>
        Move to…
      </option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="showHelper" class="mt-2 text-caption leading-5 text-on-surface-variant">
      New tasks go to the selected week.
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
    max-block-size: min(24rem, 60vh);
    overflow-y: auto;
    margin-block: 0.35rem;
    border: 1px solid color-mix(in srgb, var(--color-outline) 34%, transparent);
    border-radius: 0.875rem;
    background: linear-gradient(
      180deg,
      var(--color-surface-container-highest) 0%,
      var(--color-surface-container-high) 100%
    );
    box-shadow: var(--shadow-overlay);
    padding: 0.45rem;
  }

  .week-select option {
    display: grid;
    grid-template-columns: 1rem minmax(0, 1fr);
    align-items: center;
    gap: 0.625rem;
    min-block-size: 2.55rem;
    border-radius: 0.625rem;
    padding: 0.625rem 0.8rem;
    background-color: transparent;
    color: var(--color-on-surface);
    font-size: 0.8125rem;
    line-height: 1.125rem;
    transition:
      background-color 160ms cubic-bezier(0.16, 1, 0.3, 1),
      color 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .week-select option + option {
    margin-block-start: 0.2rem;
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
