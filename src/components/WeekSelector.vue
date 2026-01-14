<script setup lang="ts">
import { ref } from 'vue'

const _props = defineProps<{ currentWeek: number }>()
const emit = defineEmits<{
  confirm: [weekNumber: number | null]
  cancel: []
}>()

const selectedWeek = ref<number | null>(null)

function confirm() {
  emit('confirm', selectedWeek.value)
}

function cancel() {
  emit('cancel')
}
</script>

<template>
  <div class="flex flex-col gap-3 p-6 border border-gray-200 rounded-lg bg-white">
    <label class="font-medium text-gray-700">Move to week:</label>
    <select v-model="selectedWeek" class="px-2 py-2 border border-gray-300 rounded-md text-base">
      <option :value="null">
        Backlog
      </option>
      <option :value="currentWeek - 1">
        Previous ({{ currentWeek - 1 }})
      </option>
      <option :value="currentWeek">
        Current ({{ currentWeek }})
      </option>
      <option :value="currentWeek + 1">
        Next ({{ currentWeek + 1 }})
      </option>
      <option :value="currentWeek + 2">
        Week {{ currentWeek + 2 }}
      </option>
      <option :value="currentWeek + 3">
        Week {{ currentWeek + 3 }}
      </option>
    </select>
    <button class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-blue-600" @click="confirm">
      Move
    </button>
    <button class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-gray-200" @click="cancel">
      Cancel
    </button>
  </div>
</template>
