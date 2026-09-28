<script setup lang="ts">
import { computed, onMounted, reactive, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { safeParse } from 'valibot'

import { useTodos } from '@/composables/useTodos'
import { todoLabelSchema } from '@/db/collections'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'
import { focusAfterUpdate } from '@/lib/focus'
import WeekSelect from './WeekSelect.vue'

type CreateTodoValidationErrorKind = 'gate' | 'validation' | 'none'

const { addTodo, canCreateTodos, createTodoDisabledReason } = useTodos()
const router = useRouter()
const currentWeek = getCurrentWeekNumber()
const id = useId()
const formState = reactive<{ label: string; weekNumber: null | number }>({
  label: '',
  weekNumber: currentWeek,
})
const validationError = ref('')
const validationErrorKind = ref<CreateTodoValidationErrorKind>('none')
const route = useRoute()
const labelInput = ref<HTMLInputElement | null>(null)

const showWeekOptions = computed(() => formState.label.trim().length > 0)

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

watch(canCreateTodos, (nextCanCreateTodos) => {
  if (!nextCanCreateTodos || validationErrorKind.value !== 'gate') {
    return
  }

  clearValidationError()
})

function focusShortcutInput() {
  if (route.query.add === '1') {
    focusAfterUpdate(() => labelInput.value)
  }
}

onMounted(focusShortcutInput)
watch(() => route.query.add, focusShortcutInput)

async function createTodo() {
  if (!canCreateTodos.value) {
    setGateError(createTodoDisabledReason.value ?? 'You cannot create todos right now.')
    return
  }

  const trimmedLabel = formState.label.trim()
  const result = safeParse(todoLabelSchema, trimmedLabel)

  if (!result.success) {
    setValidationError(result.issues[0].message)
    return
  }

  try {
    const todoId = await addTodo(trimmedLabel, formState.weekNumber)
    clearValidationError()
    const path =
      formState.weekNumber === null
        ? `/backlog`
        : formState.weekNumber === currentWeek
          ? `/current`
          : `/future`
    await router.push({ path, hash: `#${todoId}` })
    formState.label = ''
    formState.weekNumber = currentWeek
  } catch (error) {
    setGateError(error instanceof Error ? error.message : 'Unable to create todo.')
  }
}
</script>

<template>
  <form
    class="fixed bottom-3 left-1/2 z-40 w-[min(100%-1rem,48rem)] -translate-x-1/2 sm:bottom-4"
    autocomplete="off"
    @submit.prevent="createTodo"
  >
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

      <div class="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div class="space-y-1.5">
          <label
            :for="`${id}-new`"
            class="block text-tiny font-semibold tracking-label-wider text-on-surface-variant uppercase"
          >
            New Task
          </label>
          <input
            ref="labelInput"
            :id="`${id}-new`"
            v-model="formState.label"
            placeholder="What needs to be done?"
            autocomplete="off"
            required
            class="h-12 w-full rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-4 py-0 text-body text-on-surface transition-all duration-200 placeholder:text-on-surface-variant/70 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          :disabled="!canCreateTodos"
          :title="createTodoDisabledReason ?? undefined"
          class="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 py-0 text-control font-semibold tracking-label whitespace-nowrap text-on-primary uppercase transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-high hover:shadow-primary-lift active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:w-auto"
        >
          Add Task
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
          <div class="flex flex-wrap items-end gap-3">
            <WeekSelect
              :id="`${id}-week`"
              v-model="formState.weekNumber"
              :current-week="currentWeek"
              :disabled="!canCreateTodos"
              show-helper
            />
          </div>
        </div>
      </Transition>
    </div>
  </form>
</template>
