<script setup lang="ts">
import { maxLength, minLength, pipe, regex, safeParse, string } from 'valibot'
import { computed, ref, useId } from 'vue'
import { useRouter } from 'vue-router'

import { useCreateTodoValidationState } from '@/composables/useCreateTodoValidationState'
import { useElectricTodos } from '@/composables/useElectricTodos'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

const { addTodo, canCreateTodos, createTodoDisabledReason } = useElectricTodos()
const router = useRouter()
const currentWeek = getCurrentWeekNumber()
const id = useId()
const newTodoLabel = ref('')
const newTodoWeek = ref<number | null>(null)
const validation = useCreateTodoValidationState({ canCreateTodos })
const validationError = validation.error

const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)

const showWeekOptions = computed(() => newTodoLabel.value.trim().length > 0)

async function createTodo() {
  if (!canCreateTodos.value) {
    validation.setGateError(createTodoDisabledReason.value ?? 'You cannot create todos right now.')
    return
  }

  const trimmedLabel = newTodoLabel.value.trim()
  const result = safeParse(TodoLabelSchema, trimmedLabel)

  if (!result.success) {
    validation.setValidationError(result.issues[0].message)
    return
  }

  try {
    const todoId = await addTodo(trimmedLabel, newTodoWeek.value)
    validation.clearError()
    const path =
      newTodoWeek.value === null
        ? `/backlog`
        : newTodoWeek.value === currentWeek
          ? `/current`
          : `/future`
    await router.push({ path, hash: `#${todoId}` })
    newTodoLabel.value = ''
    newTodoWeek.value = null
  } catch (error) {
    validation.setGateError(error instanceof Error ? error.message : 'Unable to create todo.')
  }
}
</script>

<template>
  <form
    class="fixed bottom-4 left-1/2 z-40 w-[min(100%-1rem,48rem)] -translate-x-1/2"
    autocomplete="off"
    @submit.prevent="createTodo"
  >
    <div
      class="rounded-3xl border border-outline-variant/10 bg-surface-container/90 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
    >
      <div
        v-if="validationError"
        aria-live="polite"
        class="animate-shake mb-3 flex items-center gap-2 rounded-2xl border border-error/20 bg-error-container/30 px-4 py-3 text-sm text-on-error-container"
      >
        <span class="font-semibold text-error">Error:</span>
        <span>{{ validationError }}</span>
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div class="space-y-1.5">
          <label
            :for="`${id}-new`"
            class="block text-[10px] font-semibold tracking-[0.3em] text-on-surface-variant uppercase"
          >
            New Task
          </label>
          <input
            :id="`${id}-new`"
            v-model="newTodoLabel"
            placeholder="What needs to be done?"
            autocomplete="off"
            required
            class="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-4 py-3 text-base text-on-surface transition-all duration-200 placeholder:text-on-surface-variant/70 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          :disabled="!canCreateTodos"
          :title="createTodoDisabledReason ?? undefined"
          class="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold tracking-[0.18em] whitespace-nowrap text-on-primary uppercase transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#c4d3ca] hover:shadow-[0_10px_24px_rgba(184,203,193,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add Task
        </button>
      </div>

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
            <div class="w-full max-w-56">
              <label
                :for="`${id}-week`"
                class="mb-1.5 block text-[10px] font-semibold tracking-[0.3em] text-on-surface-variant uppercase"
              >
                Week
              </label>
              <select
                :id="`${id}-week`"
                v-model="newTodoWeek"
                class="w-full cursor-pointer appearance-none rounded-2xl border border-outline-variant/10 bg-surface-container-highest bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a8abb0%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat px-4 py-3 pr-10 text-sm text-on-surface transition-all duration-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none"
              >
                <option :value="null">Backlog</option>
                <option :value="currentWeek">Week {{ currentWeek }} (current)</option>
                <option :value="currentWeek + 1">Week {{ currentWeek + 1 }}</option>
                <option :value="currentWeek + 2">Week {{ currentWeek + 2 }}</option>
              </select>
            </div>
            <p class="pb-3 text-xs text-on-surface-variant">Backlog by default.</p>
          </div>
        </div>
      </Transition>
    </div>
  </form>
</template>
