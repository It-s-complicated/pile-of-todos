<script setup lang="ts">
import { Archive, ArchiveRestore, ArrowRight, Check } from '@lucide/vue'
import { safeParse } from 'valibot'
import { computed, nextTick, ref, useId } from 'vue'

import { useCurrentWeek } from '@/composables/useCurrentWeek'
import { useToast } from '@/composables/useToast'
import { useTodoActions } from '@/composables/useTodoActions'
import { todoLabelSchema, type Todo } from '@/db/collections'
import { focusAfterUpdate } from '@/lib/focus'
import { getQuickMove } from '@/lib/lanes'
import { formatRelativeWeek } from '@/lib/weeks'

import WeekSelect from './WeekSelect.vue'

const props = withDefaults(
  defineProps<{
    canMutate?: boolean
    mutateDisabledReason?: string | null
    /** Show which week the task belongs to (for lanes that mix weeks). */
    showSchedule?: boolean
    todo: Todo
  }>(),
  {
    canMutate: true,
    mutateDisabledReason: null,
    showSchedule: false,
  },
)

const currentWeek = useCurrentWeek()
const actions = useTodoActions()
const toast = useToast()

const isEditing = ref(false)
const editLabel = ref(props.todo.label)
const editInput = ref<HTMLTextAreaElement | null>(null)
const labelButton = ref<HTMLButtonElement | null>(null)
const editInputId = useId()
const editHelpId = `${editInputId}-help`

const disabledTitle = computed(() =>
  props.canMutate ? undefined : (props.mutateDisabledReason ?? undefined),
)
const quickMove = computed(() => getQuickMove(props.todo, currentWeek.value))
const hasMoveActions = computed(() => !props.todo.archived && !props.todo.done)
const canEdit = computed(() => props.canMutate && !props.todo.done && !props.todo.archived)

const schedule = computed(() => {
  const { weekNumber } = props.todo

  if (weekNumber === null) {
    return { className: 'bg-secondary-container/35 text-secondary', label: 'Backlog' }
  }

  const label = formatRelativeWeek(weekNumber, currentWeek.value)

  if (weekNumber === currentWeek.value) {
    return { className: 'bg-primary-container/35 text-primary', label }
  }

  if (weekNumber > currentWeek.value) {
    return { className: 'bg-tertiary-container/20 text-tertiary', label }
  }

  return { className: 'bg-surface-container-highest text-on-surface-variant', label }
})

function startEdit() {
  if (!canEdit.value) {
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
    focusAfterUpdate(() => labelButton.value)
  }
}

function saveEdit(restoreFocus = false) {
  if (!isEditing.value) {
    return
  }

  const nextLabel = editLabel.value.trim()

  if (nextLabel && props.canMutate) {
    const result = safeParse(todoLabelSchema, nextLabel)

    if (result.success) {
      actions.rename(props.todo, nextLabel)
    } else {
      toast.show(result.issues[0].message, { tone: 'error' })
    }
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
    class="group flex flex-wrap items-start gap-x-1 rounded-2xl border border-outline-variant/10 bg-surface-container py-1 pr-2 pl-1 shadow-surface-rest transition-[background-color,border-color,box-shadow] duration-200 hover:border-outline-variant/20 hover:bg-surface-container-high sm:flex-nowrap sm:pr-3"
    :class="{ 'opacity-90': !canMutate }"
  >
    <button
      type="button"
      role="checkbox"
      :aria-checked="todo.done"
      :aria-label="todo.done ? `Mark incomplete: ${todo.label}` : `Mark complete: ${todo.label}`"
      :disabled="!canMutate || todo.archived"
      :title="disabledTitle"
      class="peer flex size-11 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed"
      @click="actions.toggleDone(todo)"
    >
      <span
        class="flex size-6 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-150 ease-out group-active:scale-95"
        :class="
          todo.done
            ? 'border-primary bg-primary text-on-primary'
            : 'border-outline-variant bg-surface-container-low hover:border-primary/70'
        "
      >
        <Check
          v-if="todo.done"
          class="animate-checkmark size-4"
          stroke-width="3"
          aria-hidden="true"
        />
      </span>
    </button>

    <div class="min-w-0 flex-1 py-1">
      <div v-if="isEditing">
        <label :for="editInputId" class="sr-only">Edit task label: {{ todo.label }}</label>
        <textarea
          :id="editInputId"
          ref="editInput"
          v-model="editLabel"
          :aria-describedby="editHelpId"
          rows="1"
          maxlength="500"
          class="block [field-sizing:content] min-h-9 w-full resize-none rounded-xl border border-primary/30 bg-surface-container-highest px-2.5 py-1.5 text-body text-on-surface focus:ring-2 focus:ring-primary/15 focus:outline-none"
          @blur="saveEdit()"
          @keydown.enter.prevent="saveEdit(true)"
          @keydown.esc.prevent.stop="cancelEdit(true)"
        />
        <p :id="editHelpId" class="sr-only">Press Enter to save or Escape to cancel.</p>
      </div>

      <button
        v-else
        ref="labelButton"
        type="button"
        class="block w-full rounded-xl border border-transparent px-1.5 py-1.5 text-left text-body wrap-break-word transition-colors duration-150 focus:outline-none focus-visible:border-primary/30"
        :class="[
          todo.done
            ? 'text-on-surface-variant line-through decoration-on-surface-variant/60'
            : 'text-on-surface',
          canEdit ? 'cursor-text hover:bg-surface-container-highest/60' : 'cursor-default',
        ]"
        :aria-label="canEdit ? `Edit task: ${todo.label}` : undefined"
        :aria-disabled="canEdit ? undefined : 'true'"
        @click="startEdit"
      >
        {{ todo.label }}
      </button>

      <p v-if="showSchedule" class="mt-0.5 px-1.5 pb-1">
        <span
          class="inline-block rounded-full px-2 py-1 text-tiny font-semibold tracking-label uppercase trim-both-cap-alphabetic"
          :class="schedule.className"
        >
          {{ schedule.label }}
        </span>
      </p>
    </div>

    <div
      v-if="canMutate"
      class="flex items-center justify-end gap-1.5 transition-opacity duration-150 sm:w-auto sm:self-center sm:pb-0 sm:pl-0 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:pointer-coarse:opacity-100"
      :class="hasMoveActions ? 'w-full pb-1.5 pl-11' : 'self-center'"
    >
      <template v-if="!todo.archived">
        <button
          v-if="quickMove"
          type="button"
          class="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant/15 px-3 text-caption font-semibold whitespace-nowrap text-on-surface-variant transition-[background-color,color,border-color] duration-150 hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
          :aria-label="`Move to ${quickMove.label.toLowerCase()}: ${todo.label}`"
          @click="actions.move(todo, quickMove.weekNumber)"
        >
          <span>{{ quickMove.label }}</span>
          <ArrowRight class="size-3.5" stroke-width="2" aria-hidden="true" />
        </button>

        <WeekSelect
          v-if="!todo.done"
          :model-value="todo.weekNumber"
          :label="`Move task: ${todo.label}`"
          variant="compact"
          @update:model-value="actions.move(todo, $event)"
        />
      </template>

      <button
        type="button"
        :aria-label="todo.archived ? `Restore: ${todo.label}` : `Archive: ${todo.label}`"
        :title="todo.archived ? 'Restore' : 'Archive'"
        class="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-[background-color,color] duration-150 hover:bg-surface-container-highest hover:text-secondary active:scale-95"
        @click="actions.toggleArchived(todo)"
      >
        <component
          :is="todo.archived ? ArchiveRestore : Archive"
          class="size-4"
          stroke-width="1.8"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
