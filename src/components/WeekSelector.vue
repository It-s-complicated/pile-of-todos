<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { nextTick, onMounted, ref, useId } from 'vue'

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
const dialog = ref<HTMLElement | null>(null)

function confirm() {
  emit('confirm', selectedWeek.value)
}

function cancel() {
  emit('cancel')
}

function getFocusableElements() {
  return Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
}

function focusInitialControl() {
  const checkedRadio = dialog.value?.querySelector<HTMLInputElement>('input[type="radio"]:checked')
  const firstRadio = dialog.value?.querySelector<HTMLInputElement>('input[type="radio"]')
  const firstFocusable = getFocusableElements()[0]

  ;(checkedRadio ?? firstRadio ?? firstFocusable ?? dialog.value)?.focus()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    cancel()
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const focusableElements = getFocusableElements()

  if (focusableElements.length === 0) {
    event.preventDefault()
    dialog.value?.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)

  if (!lastElement) {
    return
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

onMounted(() => {
  void nextTick(focusInitialControl)
})

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
    ref="dialog"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="`${id}-title`"
    tabindex="-1"
    class="animate-fade-in-up max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-outline-variant/10 bg-surface-container/95 p-4 text-on-surface shadow-floating backdrop-blur-2xl sm:max-h-[calc(100vh-2rem)] sm:p-5"
    @keydown="handleKeydown"
  >
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h3
          :id="`${id}-title`"
          class="font-headline text-headline font-extrabold tracking-tight text-on-surface"
        >
          Move to Week
        </h3>
        <p class="mt-1 max-w-[42ch] text-supporting text-on-surface-variant">
          Select a destination for this task.
        </p>
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
              <span class="block font-label text-control font-semibold text-on-surface">
                {{ option.label }}
              </span>
              <span class="block text-caption text-on-surface-variant">
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
        class="min-h-12 rounded-2xl bg-primary px-4 py-3 text-control font-semibold tracking-label text-on-primary uppercase transition-all duration-200 hover:-translate-y-0.5 hover:shadow-primary-lift active:translate-y-0"
        @click="confirm"
      >
        Move Task
      </button>
      <button
        type="button"
        class="min-h-12 rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-4 py-3 text-control font-medium text-on-surface transition-colors duration-200 hover:bg-surface-bright"
        @click="cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
