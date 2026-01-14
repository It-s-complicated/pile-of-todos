import type { Todo, TodoFilter } from '../types/todo'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTodos as useTodosDB } from '../composables/useTodos'
import { useWeekNumber } from '../composables/useWeekNumber'

export const useTodosStore = defineStore('todos', () => {
  const { getAllTodos, addTodo: addTodoDB, updateTodo: updateTodoDB, deleteTodo: deleteTodoDB, archiveTodo: archiveTodoDB, toggleTodoDone: toggleTodoDoneDB } = useTodosDB()
  const { getCurrentWeekNumber } = useWeekNumber()
  const route = useRoute()

  const todos = ref<Todo[]>([])
  const loading = ref(false)

  const currentWeekNumber = computed(() => getCurrentWeekNumber())

  const filteredTodos = computed(() => {
    const filter = (route.params.filter as TodoFilter) || route.name as TodoFilter || 'backlog'
    const weekNum = currentWeekNumber.value

    switch (filter) {
      case 'backlog':
        return todos.value.filter(t => t.weekNumber === null && !t.archived)
      case 'current-week':
        return todos.value.filter(t => t.weekNumber === weekNum && !t.archived)
      case 'future':
        return todos.value.filter(t => t.weekNumber !== null && t.weekNumber > weekNum && !t.archived)
      case 'unfinished':
        return todos.value.filter(t => t.weekNumber !== null && t.weekNumber < weekNum && !t.done && !t.archived)
      case 'archived':
        return todos.value.filter(t => t.archived === true)
      case 'finished':
        return todos.value.filter(t => t.done === true && t.archived === false)
      default:
        return todos.value
    }
  })

  async function loadTodos() {
    loading.value = true
    todos.value = await getAllTodos()
    loading.value = false
  }

  async function addTodo(label: string, weekNumber: number | null) {
    const id = await addTodoDB(label, weekNumber)
    const now = Date.now()
    todos.value.push({
      id,
      label,
      weekNumber,
      done: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
  }

  async function updateTodo(id: string, updates: Partial<Todo>) {
    await updateTodoDB(id, updates)
    const index = todos.value.findIndex(t => t.id === id)
    if (index !== -1) {
      const existingTodo = todos.value[index]
      if (existingTodo) {
        todos.value[index] = {
          id: existingTodo.id,
          label: updates.label !== undefined ? updates.label : existingTodo.label,
          weekNumber: updates.weekNumber !== undefined ? updates.weekNumber : existingTodo.weekNumber,
          done: updates.done !== undefined ? updates.done : existingTodo.done,
          archived: updates.archived !== undefined ? updates.archived : existingTodo.archived,
          createdAt: existingTodo.createdAt,
          updatedAt: Date.now(),
        }
      }
    }
  }

  async function deleteTodo(id: string) {
    await deleteTodoDB(id)
    todos.value = todos.value.filter(t => t.id !== id)
  }

  async function archiveTodo(id: string) {
    await archiveTodoDB(id)
    todos.value = todos.value.filter(t => t.id !== id)
  }

  async function toggleTodoDone(id: string) {
    await toggleTodoDoneDB(id)
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.done = !todo.done
      todo.updatedAt = Date.now()
    }
  }

  return { todos, loading, filteredTodos, currentWeekNumber, loadTodos, addTodo, updateTodo, deleteTodo, archiveTodo, toggleTodoDone }
})
