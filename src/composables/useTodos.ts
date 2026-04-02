import { useElectricTodos } from './useElectricTodos'

export function useTodos() {
  const { todos } = useElectricTodos()

  return {
    getAllTodos() {
      return [...todos.value]
    },
  }
}
