<script setup lang="ts">
import { Archive, Calendar, Check } from 'lucide-vue-next'
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
  archive: []
  move: []
}>()

const currentWeek = getCurrentWeekNumber()

const isEditing = ref(false)
const editLabel = ref(props.todo.label)
const isChecked = computed(() => props.todo.done)

const statusColor = computed(() => {
  if (props.todo.weekNumber === null) {
    return 'var(--color-secondary)'
  }

  if (props.todo.weekNumber === currentWeek) {
    return 'var(--color-primary)'
  }

  if (props.todo.weekNumber > currentWeek) {
    return 'var(--color-tertiary)'
  }

  return 'var(--color-error)'
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

function toggleDone() {
  if (!props.canMutate) {
    return
  }

  emit('update', { done: !props.todo.done })
}

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
    class="group flex flex-col gap-4 rounded-[1.5rem] border border-outline-variant/10 bg-surface-container p-5 shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
    :class="{ 'opacity-90': !canMutate }"
    :style="{ borderLeft: `3px solid ${statusColor}` }"
  >
    <div class="flex min-w-0 items-start gap-4 sm:gap-5">
      <button
        type="button"
        role="checkbox"
        :aria-checked="isChecked"
        :aria-label="isChecked ? 'Mark as incomplete' : 'Mark as complete'"
        :disabled="!canMutate"
        :title="!canMutate ? (mutateDisabledReason ?? undefined) : undefined"
        class="relative mt-0.5 size-6 shrink-0 rounded-full border border-outline-variant/70 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
        :class="
          isChecked
            ? 'border-primary bg-primary text-on-primary'
            : 'bg-transparent hover:border-primary/70'
        "
        @click="toggleDone"
      >
        <Check
          v-if="isChecked"
          class="absolute inset-0 h-full w-full p-0.5 text-on-primary transition-transform duration-200"
          :class="{ 'animate-checkmark': isChecked }"
          stroke-width="3"
        />
      </button>

      <div class="min-w-0">
        <input
          v-if="isEditing"
          v-model="editLabel"
          :disabled="!canMutate"
          :title="!canMutate ? (mutateDisabledReason ?? undefined) : undefined"
          class="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-highest px-3 py-2 text-base text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          @blur="saveEdit"
          @keyup.enter="saveEdit"
          @keyup.esc="cancelEdit"
        />
        <div
          v-else
          class="select-none"
          :class="{
            'cursor-pointer': canMutate && !todo.done,
            'cursor-default': !canMutate || todo.done,
          }"
          @dblclick="startEdit"
        >
          <p
            class="text-base leading-snug text-on-surface transition-all duration-200 sm:text-[1.05rem]"
            :class="{
              'text-on-surface-variant line-through': todo.done,
              'text-on-surface': !todo.done,
            }"
          >
            {{ todo.label }}
          </p>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span
              class="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.24em] uppercase"
              :class="scheduleBadge.className"
            >
              {{ scheduleBadge.label }}
            </span>
            <span
              class="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.24em] uppercase"
              :class="lifecycleBadge.className"
            >
              {{ lifecycleBadge.label }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex items-center gap-1 self-end opacity-100 transition-opacity duration-200 sm:self-auto sm:opacity-0 sm:group-hover:opacity-100"
    >
      <button
        type="button"
        :disabled="!canMutate"
        :title="canMutate ? 'Move to different week' : (mutateDisabledReason ?? undefined)"
        class="rounded-full p-2 text-on-surface-variant transition-all duration-150 hover:bg-surface-container-highest hover:text-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('move')"
      >
        <Calendar class="size-4" stroke-width="1.8" />
      </button>
      <button
        type="button"
        :disabled="!canMutate"
        :title="canMutate ? 'Archive' : (mutateDisabledReason ?? undefined)"
        class="rounded-full p-2 text-on-surface-variant transition-all duration-150 hover:bg-surface-container-highest hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('archive')"
      >
        <Archive class="size-4" stroke-width="1.8" />
      </button>
    </div>
  </div>
</template>
