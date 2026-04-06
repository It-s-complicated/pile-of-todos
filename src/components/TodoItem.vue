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
    return 'var(--color-week-backlog)'
  }
  if (props.todo.weekNumber === currentWeek) {
    return 'var(--color-week-current)'
  }
  if (props.todo.weekNumber > currentWeek) {
    return 'var(--color-week-future)'
  }
  return 'var(--color-week-past)'
})

const weekStatusLabel = computed(() => {
  if (props.todo.weekNumber === null) {
    return 'Backlog'
  }
  if (props.todo.weekNumber === currentWeek) {
    return `Week ${props.todo.weekNumber} · Current`
  }
  if (props.todo.weekNumber > currentWeek) {
    return `Week ${props.todo.weekNumber} · Future`
  }
  return `Week ${props.todo.weekNumber} · Past`
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
    class="group flex items-center gap-4 rounded-lg border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    :style="{ borderLeft: `3px solid ${statusColor}` }"
  >
    <button
      type="button"
      role="checkbox"
      :aria-checked="isChecked"
      :aria-label="isChecked ? 'Mark as incomplete' : 'Mark as complete'"
      :disabled="!canMutate"
      :title="!canMutate ? (mutateDisabledReason ?? undefined) : undefined"
      class="relative size-5 shrink-0 scroll-pr-0.5 rounded border-2 border-navy transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      :class="{ 'bg-navy': isChecked, 'bg-white': !isChecked }"
      @click="toggleDone"
    >
      <Check
        v-if="isChecked"
        class="absolute inset-0 h-full w-full p-0.5 text-white transition-transform duration-200"
        :class="{ 'animate-checkmark': isChecked }"
        stroke-width="3"
      />
    </button>

    <div class="min-w-0 flex-1">
      <input
        v-if="isEditing"
        v-model="editLabel"
        class="w-full rounded border border-border bg-cream px-2 py-1 text-navy focus:border-navy focus:ring-1 focus:ring-navy/10 focus:outline-none"
        @blur="saveEdit"
        @keyup.enter="saveEdit"
        @keyup.esc="cancelEdit"
      />
      <div
        v-else
        :class="{
          'cursor-pointer': canMutate && !todo.done,
          'cursor-default': !canMutate || todo.done,
        }"
        @dblclick="startEdit"
      >
        <p
          class="text-base leading-snug transition-all duration-200"
          :class="{ 'text-text-muted line-through': todo.done, 'text-navy': !todo.done }"
        >
          {{ todo.label }}
        </p>
        <p class="mt-1 flex items-center gap-1.5 font-mono text-xs text-text-muted">
          <Calendar class="size-3" stroke-width="1.5" />
          {{ weekStatusLabel }}
        </p>
      </div>
    </div>

    <div
      class="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
    >
      <button
        type="button"
        :disabled="!canMutate"
        :title="canMutate ? 'Move to different week' : (mutateDisabledReason ?? undefined)"
        class="rounded-md p-2 text-text-muted transition-all duration-150 hover:bg-cream hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('move')"
      >
        <Calendar class="size-4" stroke-width="1.5" />
      </button>
      <button
        type="button"
        :disabled="!canMutate"
        :title="canMutate ? 'Archive' : (mutateDisabledReason ?? undefined)"
        class="rounded-md p-2 text-text-muted transition-all duration-150 hover:bg-danger-light hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('archive')"
      >
        <Archive class="size-4" stroke-width="1.5" />
      </button>
    </div>
  </div>
</template>
