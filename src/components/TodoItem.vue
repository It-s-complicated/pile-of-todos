<script setup lang="ts">
import type { Todo } from '../types/todo'
import { ref } from 'vue'

const props = defineProps<{ todo: Todo }>()
const emit = defineEmits<{
  update: [updates: Partial<Todo>]
  archive: []
  move: []
}>()

const isEditing = ref(false)
const editLabel = ref(props.todo.label)

function toggleDone() {
  emit('update', { done: !props.todo.done })
}

function startEdit() {
  isEditing.value = true
}

function saveEdit() {
  if (editLabel.value.trim()) {
    emit('update', { label: editLabel.value.trim() })
  }
  isEditing.value = false
}
</script>

<template>
  <div class="flex gap-3 items-center p-3 border border-gray-200 rounded-lg bg-white">
    <input type="checkbox" :checked="todo.done" class="w-5 h-5 cursor-pointer" @change="toggleDone">
    <input v-if="isEditing" v-model="editLabel" class="flex-1 px-2 py-1 border border-gray-300 rounded-md" @blur="saveEdit" @keyup.enter="saveEdit">
    <span v-else class="flex-1 cursor-pointer" :class="{ 'line-through text-gray-400': todo.done }" @dblclick="startEdit">{{ todo.label }}</span>
    <button class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-gray-200" @click="$emit('move')">
      Move
    </button>
    <button class="px-4 py-2 bg-red-100 text-red-800 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-red-200" @click="$emit('archive')">
      Archive
    </button>
  </div>
</template>
