<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'

import type { Todo } from '../db/collections'
import { getCurrentWeekNumber } from '@/lib/get-current-week-number'

const props = withDefaults(
  defineProps<{
    canMutate?: boolean
    mutateDisabledReason?: string | null
    todo: Todo
  }>(),
  {
    canMutate: true,
    mutateDisabledReason: null,
  },
)

const emit = defineEmits<{
  update: [updates: Partial<Todo>]
}>()

const slots = defineSlots<{
  primaryAction?: () => any
  actions?: () => any
}>()

const currentWeek = getCurrentWeekNumber()

const isEditing = ref(false)
const editLabel = ref(props.todo.label)
const editInput = ref<HTMLInputElement | null>(null)
const editInputId = useId()
const editHelpId = `${editInputId}-help`
const statusTone = computed(() => {
  if (props.todo.weekNumber === null) {
    return {
      borderClass: 'hover:border-secondary/25',
      checkboxRingClass: 'group-has-[[role=checkbox]:hover]:border-secondary/20',
      dotClass: 'bg-secondary shadow-[0_0_0_3px_rgb(226_190_193_/_0.08)]',
    }
  }

  if (props.todo.weekNumber === currentWeek) {
    return {
      borderClass: 'hover:border-primary/25',
      checkboxRingClass: 'group-has-[[role=checkbox]:hover]:border-primary/20',
      dotClass: 'bg-primary shadow-[0_0_0_3px_rgb(184_203_193_/_0.08)]',
    }
  }

  if (props.todo.weekNumber > currentWeek) {
    return {
      borderClass: 'hover:border-tertiary/25',
      checkboxRingClass: 'group-has-[[role=checkbox]:hover]:border-tertiary/20',
      dotClass: 'bg-tertiary shadow-[0_0_0_3px_rgb(243_246_255_/_0.08)]',
    }
  }

  return {
    borderClass: 'hover:border-error/30',
    checkboxRingClass: 'group-has-[[role=checkbox]:hover]:border-error/20',
    dotClass: 'bg-error shadow-[0_0_0_3px_rgb(250_116_111_/_0.08)]',
  }
})

type BadgeTone = {
  className: string
  label: string
}

const scheduleBadge = computed<BadgeTone>(() => {
  if (props.todo.weekNumber === null) {
    return {
      className: 'bg-secondary-container/35 text-secondary',
      label: 'Backlog',
    }
  }

  if (props.todo.weekNumber === currentWeek) {
    return {
      className: 'bg-primary-container/35 text-primary',
      label: `Week ${props.todo.weekNumber} · Current`,
    }
  }

  if (props.todo.weekNumber > currentWeek) {
    return {
      className: 'bg-tertiary-container/25 text-tertiary',
      label: `Week ${props.todo.weekNumber} · Future`,
    }
  }

  return {
    className: 'bg-error-container/25 text-error',
    label: `Week ${props.todo.weekNumber} · Past`,
  }
})

const lifecycleBadge = computed<BadgeTone>(() => {
  if (props.todo.archived) {
    return {
      className: 'bg-secondary-container/25 text-secondary',
      label: 'Archived',
    }
  }

  if (props.todo.done) {
    return {
      className: 'bg-primary-container/25 text-primary',
      label: 'Complete',
    }
  }

  return {
    className: 'bg-surface-container-highest text-on-surface-variant',
    label: 'Active',
  }
})

function startEdit() {
  if (!props.canMutate || props.todo.done) {
    return
  }

  editLabel.value = props.todo.label
  isEditing.value = true
  void nextTick(() => {
    editInput.value?.focus()
    editInput.value?.select()
  })
}

function saveEdit() {
  if (!props.canMutate) {
    cancelEdit()
    return
  }

  if (editLabel.value.trim()) {
    emit('update', { label: editLabel.value.trim() })
  }
  isEditing.value = false
}

function cancelEdit() {
  editLabel.value = props.todo.label
  isEditing.value = false
}
</script>

<template>
  <div
    class="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-3xl border border-outline-variant/10 bg-surface-container p-4 shadow-surface-rest transition-[background-color,border-color,box-shadow,opacity,transform] duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-surface-hover sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:p-5"
    :class="[statusTone.borderClass, statusTone.checkboxRingClass, { 'opacity-90': !canMutate }]"
  >
    <div
      v-if="slots.primaryAction"
      class="row-span-2 flex min-w-11 justify-center self-start pt-0.5 sm:min-w-9"
    >
      <slot name="primaryAction" />
    </div>

    <div
      class="min-w-0"
      :class="{
        'col-start-2': slots.primaryAction,
        'col-span-full col-start-1': !slots.primaryAction,
      }"
    >
      <div v-if="isEditing" class="row-span-2 space-y-2">
        <label :for="editInputId" class="sr-only">Edit task label: {{ todo.label }}</label>
        <input
          :id="editInputId"
          ref="editInput"
          v-model="editLabel"
          :disabled="!canMutate"
          :title="!canMutate ? (mutateDisabledReason ?? undefined) : undefined"
          :aria-describedby="editHelpId"
          class="min-h-11 w-full rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-3 py-2 text-base text-on-surface transition-colors duration-200 placeholder:text-on-surface-variant/70 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          @blur="saveEdit"
          @keyup.enter="saveEdit"
          @keyup.esc="cancelEdit"
        />
        <p :id="editHelpId" class="sr-only">Press Enter to save or Escape to cancel.</p>
      </div>
      <div
        v-else
        class="grid gap-3 select-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
        @dblclick="startEdit"
      >
        <p
          class="min-w-0 pt-1 text-base leading-6 wrap-break-word text-on-surface transition-colors duration-200"
          :class="{
            'text-on-surface-variant line-through': todo.done,
            'text-on-surface': !todo.done,
          }"
        >
          {{ todo.label }}
        </p>

        <button
          v-if="canMutate && !todo.done"
          type="button"
          class="inline-flex min-h-11 w-fit items-center rounded-full px-3 text-tiny font-semibold tracking-looser text-on-surface-variant uppercase transition-[background-color,color,opacity,transform] duration-150 trim-both-cap-alphabetic hover:bg-surface-container-highest hover:text-primary focus:outline-none focus-visible:bg-surface-container-highest focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-95 sm:min-h-8 sm:justify-self-end sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:pointer-coarse:opacity-100"
          :aria-label="`Edit task label: ${todo.label}`"
          @click="startEdit"
        >
          Edit
        </button>

        <div
          class="flex flex-wrap items-center gap-1.5 self-start border-t border-outline-variant/8 pt-3 sm:col-span-2"
        >
          <span aria-hidden="true" class="mr-1 size-2 rounded-full" :class="statusTone.dotClass" />
          <span
            v-for="badge in [scheduleBadge, lifecycleBadge]"
            :key="badge.label"
            class="rounded-full px-2.5 py-1 text-tiny font-semibold tracking-looser uppercase trim-both-cap-alphabetic"
            :class="badge.className"
          >
            {{ badge.label }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="slots.actions"
      class="col-span-full flex items-center gap-1 justify-self-end border-t border-outline-variant/8 pt-1 opacity-100 transition-opacity duration-150 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:self-start sm:border-t-0 sm:pt-0 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:pointer-coarse:opacity-100"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
