<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'

import type { Todo } from '../db/collections'
import { focusAfterUpdate } from '@/lib/focus'
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
const editInput = ref<HTMLTextAreaElement | null>(null)
const editButton = ref<HTMLButtonElement | null>(null)
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

function finishEdit(restoreFocus: boolean) {
  isEditing.value = false

  if (restoreFocus) {
    focusAfterUpdate(() => editButton.value)
  }
}

function saveEdit(restoreFocus = false) {
  if (!props.canMutate) {
    cancelEdit(restoreFocus)
    return
  }

  if (editLabel.value.trim()) {
    emit('update', { label: editLabel.value.trim() })
  }
  finishEdit(restoreFocus)
}

function cancelEdit(restoreFocus = false) {
  editLabel.value = props.todo.label
  finishEdit(restoreFocus)
}
</script>

<template>
  <div
    class="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-3xl border border-outline-variant/10 bg-surface-container p-4 shadow-surface-rest transition-[background-color,border-color,box-shadow,opacity,transform] duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-surface-hover sm:gap-x-4 sm:p-5"
    :class="[statusTone.borderClass, statusTone.checkboxRingClass, { 'opacity-90': !canMutate }]"
  >
    <div v-if="slots.primaryAction" class="row-span-2 flex min-w-11 justify-center self-start">
      <slot name="primaryAction" />
    </div>

    <div
      class="min-w-0 space-y-3"
      :class="{
        'col-start-2': slots.primaryAction,
        'col-span-full col-start-1': !slots.primaryAction,
      }"
    >
      <div class="flex min-w-0 items-start gap-3 sm:min-h-10 sm:items-center">
        <div v-if="isEditing" class="min-w-0 flex-1">
          <label :for="editInputId" class="sr-only">Edit task label: {{ todo.label }}</label>
          <textarea
            :id="editInputId"
            ref="editInput"
            v-model="editLabel"
            :disabled="!canMutate"
            :title="!canMutate ? (mutateDisabledReason ?? undefined) : undefined"
            :aria-describedby="editHelpId"
            rows="1"
            class="min-h-11 w-full resize-none overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-3 py-2 text-body text-on-surface transition-colors duration-200 placeholder:text-on-surface-variant/70 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            @blur="saveEdit()"
            @keydown.enter.prevent="saveEdit(true)"
            @keydown.esc.prevent.stop="cancelEdit(true)"
          />
          <p :id="editHelpId" class="sr-only">Press Enter to save or Escape to cancel.</p>
        </div>

        <div v-else class="min-w-0 flex-1 select-none" @dblclick="startEdit">
          <p
            class="min-h-11 rounded-2xl border border-transparent px-3 py-2 text-body wrap-break-word text-on-surface transition-colors duration-200"
            :class="{
              'text-on-surface-variant line-through': todo.done,
              'text-on-surface': !todo.done,
            }"
          >
            {{ todo.label }}
          </p>
        </div>

        <button
          v-if="canMutate && !todo.done"
          ref="editButton"
          type="button"
          class="inline-flex min-h-8 shrink-0 items-center rounded-full px-2.5 text-tiny font-semibold tracking-label-wide text-on-surface-variant uppercase transition-[background-color,color,opacity,transform] duration-150 trim-both-cap-alphabetic hover:bg-surface-container-highest hover:text-primary focus:outline-none focus-visible:bg-surface-container-highest focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-95 sm:pointer-events-none sm:min-h-10 sm:justify-self-end sm:px-3.5 sm:opacity-0 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:pointer-coarse:pointer-events-auto sm:pointer-coarse:opacity-100"
          :class="{ 'pointer-events-none invisible': isEditing }"
          :aria-hidden="isEditing ? 'true' : undefined"
          :tabindex="isEditing ? -1 : undefined"
          :aria-label="`Edit task label: ${todo.label}`"
          @click="startEdit"
        >
          Edit
        </button>
      </div>

      <div
        class="flex flex-col gap-3 border-t border-outline-variant/8 pt-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-1.5">
          <span aria-hidden="true" class="mr-1 size-2 rounded-full" :class="statusTone.dotClass" />
          <span
            v-for="badge in [scheduleBadge, lifecycleBadge]"
            :key="badge.label"
            class="rounded-full px-2.5 py-1 text-tiny font-semibold tracking-label-wide uppercase trim-both-cap-alphabetic"
            :class="badge.className"
          >
            {{ badge.label }}
          </span>
        </div>

        <div
          v-if="slots.actions"
          class="flex min-w-0 items-center gap-2 opacity-100 transition-opacity duration-150 sm:pointer-events-none sm:justify-end sm:opacity-0 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:pointer-coarse:pointer-events-auto sm:pointer-coarse:opacity-100"
        >
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>
