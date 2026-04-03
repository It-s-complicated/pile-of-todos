import { nextTick, ref } from 'vue'
import { assert, test, vi } from 'vite-plus/test'

import { useCreateTodoValidationState } from './useCreateTodoValidationState.ts'

test('useCreateTodoValidationState clears stale gate errors when create becomes allowed again', async () => {
  const canCreateTodos = ref(false)
  const validation = useCreateTodoValidationState({ canCreateTodos })

  validation.setGateError('Sign in with the approved account to create todos.')
  assert.equal(validation.error.value, 'Sign in with the approved account to create todos.')

  canCreateTodos.value = true
  await nextTick()

  assert.equal(validation.error.value, '')
})

test('useCreateTodoValidationState keeps schema validation errors when create becomes allowed again', async () => {
  const canCreateTodos = ref(false)
  const validation = useCreateTodoValidationState({ canCreateTodos })

  validation.setValidationError('Label cannot be empty')
  assert.equal(validation.error.value, 'Label cannot be empty')

  canCreateTodos.value = true
  await nextTick()

  assert.equal(validation.error.value, 'Label cannot be empty')
})

test('useCreateTodoValidationState does not auto-clear validation errors with time', () => {
  vi.useFakeTimers()

  const validation = useCreateTodoValidationState({
    canCreateTodos: ref(true),
  })

  validation.setValidationError('Label cannot be empty')
  vi.advanceTimersByTime(5000)

  assert.equal(validation.error.value, 'Label cannot be empty')

  vi.useRealTimers()
})

test('useCreateTodoValidationState does not clear a later gate error from an earlier validation path over time', () => {
  vi.useFakeTimers()

  const validation = useCreateTodoValidationState({
    canCreateTodos: ref(false),
  })

  validation.setValidationError('Label cannot be empty')
  validation.setGateError('Sign in with the approved account to create todos.')
  vi.advanceTimersByTime(5000)

  assert.equal(validation.error.value, 'Sign in with the approved account to create todos.')

  vi.useRealTimers()
})

test('useCreateTodoValidationState clears the current error after a successful create', () => {
  const validation = useCreateTodoValidationState({
    canCreateTodos: ref(true),
  })

  validation.setGateError('Sign in with the approved account to create todos.')
  validation.clearError()

  assert.equal(validation.error.value, '')
})
