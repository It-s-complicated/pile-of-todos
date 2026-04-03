import { ref, watch } from 'vue'
import type { Ref } from 'vue'

type UseCreateTodoValidationStateOptions = {
  canCreateTodos: Ref<boolean>
}

type CreateTodoValidationErrorKind = 'gate' | 'validation' | 'none'

export function useCreateTodoValidationState({
  canCreateTodos,
}: UseCreateTodoValidationStateOptions) {
  const error = ref('')
  const errorKind = ref<CreateTodoValidationErrorKind>('none')

  function clearError() {
    error.value = ''
    errorKind.value = 'none'
  }

  function setGateError(message: string) {
    error.value = message
    errorKind.value = 'gate'
  }

  function setValidationError(message: string) {
    error.value = message
    errorKind.value = 'validation'
  }

  watch(canCreateTodos, (nextCanCreateTodos) => {
    if (!nextCanCreateTodos || errorKind.value !== 'gate') {
      return
    }

    clearError()
  })

  return {
    clearError,
    error,
    setGateError,
    setValidationError,
  }
}
