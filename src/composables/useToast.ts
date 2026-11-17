import { readonly, ref } from 'vue'

export type ToastAction = {
  label: string
  run: () => void
}

export type Toast = {
  id: number
  message: string
  tone: 'neutral' | 'error'
  action: ToastAction | null
}

const TOAST_DURATION_MS = 5000

const toast = ref<Toast | null>(null)
let nextId = 1
let dismissTimer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

function dismiss() {
  clearTimer()
  toast.value = null
}

function scheduleDismiss() {
  clearTimer()
  dismissTimer = setTimeout(dismiss, TOAST_DURATION_MS)
}

function show(message: string, options: { action?: ToastAction; tone?: Toast['tone'] } = {}) {
  toast.value = {
    id: nextId++,
    message,
    tone: options.tone ?? 'neutral',
    action: options.action ?? null,
  }
  scheduleDismiss()
}

/** One quiet, replaceable notice at a time — newer actions replace older ones. */
export function useToast() {
  return {
    dismiss,
    /** Pause auto-dismiss while the pointer or focus is on the toast. */
    hold: clearTimer,
    release: () => {
      if (toast.value) scheduleDismiss()
    },
    show,
    toast: readonly(toast),
  }
}
