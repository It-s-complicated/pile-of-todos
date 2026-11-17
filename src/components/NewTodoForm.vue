<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { safeParse } from 'valibot'

import { useCurrentWeek } from '@/composables/useCurrentWeek'
import { useToast } from '@/composables/useToast'
import { useTodos } from '@/composables/useTodos'
import { todoLabelSchema } from '@/db/collections'
import { focusAfterUpdate } from '@/lib/focus'
import { getSharedTodoLabel } from '@/lib/shared-todo'
import { addWeeks, formatRelativeWeek, type WeekKey } from '@/lib/weeks'
import WeekSelect from './WeekSelect.vue'

type CreateTodoValidationErrorKind = 'gate' | 'validation' | 'none'

const ALLOWED_LABEL_CHARACTER = /[a-z0-9\s\-.,!?@+#$%&*'()]/i

const { addTodo, canCreateTodos, createTodoDisabledReason } = useTodos()
const router = useRouter()
const route = useRoute()
const currentWeek = useCurrentWeek()
const toast = useToast()
const id = useId()
const label = ref('')
const chosenWeek = ref<WeekKey | null>(null)
/** Set once the user picks a week by hand, so navigating lanes doesn't overwrite the choice. */
const hasChosenWeek = ref(false)
const validationError = ref('')
const isSubmitting = ref(false)
const validationErrorKind = ref<CreateTodoValidationErrorKind>('none')
const labelInput = ref<HTMLTextAreaElement | null>(null)

/** New tasks default to the lane you're looking at. */
const laneDefaultWeek = computed<WeekKey | null>(() => {
  switch (route.path) {
    case '/backlog':
      return null
    case '/future':
      return addWeeks(currentWeek.value, 1)
    default:
      return currentWeek.value
  }
})

const weekNumber = computed<WeekKey | null>({
  get: () => (hasChosenWeek.value ? chosenWeek.value : laneDefaultWeek.value),
  set: (value) => {
    chosenWeek.value = value
    hasChosenWeek.value = true
  },
})

const destinationName = computed(() =>
  weekNumber.value === null ? 'backlog' : formatRelativeWeek(weekNumber.value, currentWeek.value),
)
const placeholder = computed(() =>
  weekNumber.value === null
    ? 'Add to backlog…'
    : `Add to ${destinationName.value.replace(/^This|^Next|^Last/, (word) => word.toLowerCase())}…`,
)
const showWeekOptions = computed(() => label.value.trim().length > 0)

function laneOfWeek(value: WeekKey | null) {
  if (value === null) return '/backlog'
  if (value === currentWeek.value) return '/current'
  return value > currentWeek.value ? '/future' : '/unfinished'
}

function clearValidationError() {
  validationError.value = ''
  validationErrorKind.value = 'none'
}

function setGateError(message: string) {
  validationError.value = message
  validationErrorKind.value = 'gate'
}

function setValidationError(message: string) {
  validationError.value = message
  validationErrorKind.value = 'validation'
}

function describeInvalidCharacters(value: string) {
  const invalid = [...new Set([...value].filter((char) => !ALLOWED_LABEL_CHARACTER.test(char)))]
  return invalid.length > 0
    ? `Can't use ${invalid.map((char) => `“${char}”`).join(' ')} in a task yet.`
    : null
}

watch(canCreateTodos, (nextCanCreateTodos) => {
  if (!nextCanCreateTodos || validationErrorKind.value !== 'gate') {
    return
  }

  clearValidationError()
})

watch(label, () => {
  if (validationErrorKind.value === 'validation') {
    clearValidationError()
  }
})

function focusInput() {
  focusAfterUpdate(() => labelInput.value)
}

function focusShortcutInput() {
  if (route.query.add === '1') {
    focusInput()
  }
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  )
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    isEditableTarget(event.target)
  ) {
    return
  }

  if (event.key === 'n' || event.key === '/') {
    event.preventDefault()
    labelInput.value?.focus()
  }
}

onMounted(() => {
  focusShortcutInput()
  window.addEventListener('keydown', handleGlobalKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalKeydown))
watch(() => route.query.add, focusShortcutInput)
watch(
  () => route.query,
  (query) => {
    const shared = getSharedTodoLabel(query)
    if (!shared) return

    label.value = shared
    chosenWeek.value = null
    hasChosenWeek.value = true
    clearValidationError()
    focusInput()
    const remainingQuery = { ...query }
    for (const key of ['share_title', 'share_text', 'share_url']) delete remainingQuery[key]
    void router.replace({ query: remainingQuery, hash: route.hash })
  },
  { immediate: true },
)

function handleEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  void createTodo()
}

async function createTodo() {
  if (isSubmitting.value) return
  if (!canCreateTodos.value) {
    setGateError(createTodoDisabledReason.value ?? 'You cannot create todos right now.')
    return
  }

  const trimmedLabel = label.value.trim()
  const result = safeParse(todoLabelSchema, trimmedLabel)

  if (!result.success) {
    setValidationError(describeInvalidCharacters(trimmedLabel) ?? result.issues[0].message)
    return
  }

  const targetWeek = weekNumber.value

  isSubmitting.value = true
  try {
    const todoId = await addTodo(trimmedLabel, targetWeek)
    clearValidationError()
    label.value = ''
    hasChosenWeek.value = false
    focusInput()

    const targetLane = laneOfWeek(targetWeek)

    if (targetLane !== route.path) {
      const destination =
        targetWeek === null ? 'backlog' : formatRelativeWeek(targetWeek, currentWeek.value)
      toast.show(`Added to ${destination}`, {
        action: {
          label: 'View',
          run: () => {
            toast.dismiss()
            void router.push({ path: targetLane, hash: `#${todoId}` })
          },
        },
      })
    }
  } catch (error) {
    setGateError(error instanceof Error ? error.message : 'Unable to create todo.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="w-full" autocomplete="off" @submit.prevent="createTodo">
    <div
      class="rounded-3xl border border-outline-variant/10 bg-surface-container/90 p-3 shadow-floating backdrop-blur-2xl sm:p-3.5"
    >
      <div
        v-if="validationError"
        aria-live="polite"
        class="animate-shake mb-3 flex items-center gap-2 rounded-2xl border border-error/20 bg-error-container/30 px-4 py-3 text-supporting text-on-error-container"
      >
        <span class="font-semibold text-error">Error:</span>
        <span>{{ validationError }}</span>
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:gap-3">
        <div class="space-y-1.5">
          <label :for="`${id}-new`" class="sr-only">New task</label>
          <textarea
            ref="labelInput"
            :id="`${id}-new`"
            v-model="label"
            :placeholder="placeholder"
            aria-keyshortcuts="n /"
            rows="1"
            enterkeyhint="done"
            autocomplete="off"
            required
            @keydown.enter.exact="handleEnter"
            @keydown.esc="labelInput?.blur()"
            class="max-h-40 min-h-12 w-full resize-y rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-4 py-3 text-body text-on-surface transition-all duration-200 placeholder:text-on-surface-variant/70 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          :disabled="!canCreateTodos || isSubmitting"
          :title="createTodoDisabledReason ?? undefined"
          :aria-label="`Add task to ${destinationName}`"
          class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary px-0 py-0 text-control font-semibold tracking-label whitespace-nowrap text-on-primary uppercase transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-high hover:shadow-primary-lift active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:w-auto sm:px-5"
        >
          <Plus class="size-5 sm:hidden" stroke-width="2.4" aria-hidden="true" />
          <span class="hidden sm:inline">Add task</span>
        </button>
      </div>
      <p
        v-if="!canCreateTodos && createTodoDisabledReason"
        class="mt-2 text-caption leading-5 text-on-surface-variant"
      >
        {{ createTodoDisabledReason }}
      </p>

      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-40 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="max-h-40 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div v-if="showWeekOptions" class="mt-3 overflow-hidden">
          <WeekSelect
            :id="`${id}-week`"
            v-model="weekNumber"
            :disabled="!canCreateTodos"
            label="Add to"
          />
        </div>
      </Transition>
    </div>
  </form>
</template>
