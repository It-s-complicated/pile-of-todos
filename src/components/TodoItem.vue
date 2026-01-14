<template>
  <div class="flex gap-3 items-center p-3 border border-gray-200 rounded-lg bg-white">
    <input type="checkbox" :checked="todo.done" @change="toggleDone" class="w-5 h-5 cursor-pointer" />
    <input v-if="isEditing" v-model="editLabel" @blur="saveEdit" @keyup.enter="saveEdit" class="flex-1 px-2 py-1 border border-gray-300 rounded-md" />
    <span v-else @dblclick="startEdit" class="flex-1 cursor-pointer" :class="{ 'line-through text-gray-400': todo.done }">{{ todo.label }}</span>
    <button @click="$emit('move')" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-gray-200">Move</button>
    <button @click="$emit('archive')" class="px-4 py-2 bg-red-100 text-red-800 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-red-200">Archive</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Todo } from '../types/todo'

const props = defineProps<{ todo: Todo }>()
const emit = defineEmits(['update', 'archive', 'move'])

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
