<script setup lang="ts">
import { computed, ref } from 'vue'

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
const statusTone = computed(() => {
  if (props.todo.weekNumber === null) {
    return {
      borderClass: 'hover:border-secondary/20',
      dotClass: 'bg-secondary',
    }
  }

  if (props.todo.weekNumber === currentWeek) {
    return {
      borderClass: 'hover:border-primary/20',
      dotClass: 'bg-primary',
    }
  }

  if (props.todo.weekNumber > currentWeek) {
    return {
      borderClass: 'hover:border-tertiary/20',
      dotClass: 'bg-tertiary',
    }
  }

  return {
    borderClass: 'hover:border-error/25',
    dotClass: 'bg-error',
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

  isEditing.value = true
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
    class="group grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-3 gap-y-3 rounded-3xl border border-outline-variant/10 bg-surface-container p-4 shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:gap-x-5 sm:p-6"
    :class="[statusTone.borderClass, { 'opacity-90': !canMutate }]"
  >
    <div
      v-if="slots.primaryAction"
      class="row-span-2 flex min-w-11 justify-center self-start sm:min-w-10"
    >
      <slot name="primaryAction" />
    </div>

    <div
      class="row-span-2 grid min-w-0 grid-rows-subgrid"
      :class="{
        'col-start-2': slots.primaryAction,
        'col-span-2 col-start-1': !slots.primaryAction,
      }"
    >
      <input
        v-if="isEditing"
        v-model="editLabel"
        :disabled="!canMutate"
        :title="!canMutate ? (mutateDisabledReason ?? undefined) : undefined"
        class="row-span-2 min-h-11 w-full rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-3 py-2 text-base text-on-surface transition-all duration-200 placeholder:text-on-surface-variant/70 hover:border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        @blur="saveEdit"
        @keyup.enter="saveEdit"
        @keyup.esc="cancelEdit"
      />
      <div
        v-else
        class="row-span-2 grid grid-rows-subgrid pt-2 select-none"
        :class="{
          'cursor-pointer': canMutate && !todo.done,
          'cursor-default': !canMutate || todo.done,
        }"
        @dblclick="startEdit"
      >
        <p
          class="row-start-1 text-base leading-snug wrap-break-word text-on-surface transition-all duration-200 trim-both-cap-alphabetic"
          :class="{
            'text-on-surface-variant line-through': todo.done,
            'text-on-surface': !todo.done,
          }"
        >
          {{ todo.label }}
        </p>

        <div class="row-start-2 flex flex-wrap items-center gap-2 self-start">
          <span
            aria-hidden="true"
            class="size-2.5 rounded-full ring-2 ring-surface-container-high"
            :class="statusTone.dotClass"
          />
          <span
            v-for="badge in [scheduleBadge, lifecycleBadge]"
            :key="badge.label"
            class="rounded-full px-2.5 py-1.5 text-tiny font-semibold tracking-looser uppercase trim-both-cap-alphabetic"
            :class="badge.className"
          >
            {{ badge.label }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="slots.actions"
      class="col-span-full row-start-3 flex items-center gap-1 self-end justify-self-end opacity-100 transition-opacity duration-200 sm:col-span-1 sm:col-start-3 sm:row-span-full sm:self-center sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
