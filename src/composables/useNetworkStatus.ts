import { ref } from 'vue'

const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
let listenersAttached = false

function handleOnline() {
  isOnline.value = true
}

function handleOffline() {
  isOnline.value = false
}

function attachListeners() {
  if (listenersAttached || typeof window === 'undefined') {
    return
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  listenersAttached = true
}

export function useNetworkStatus() {
  attachListeners()
  return { isOnline }
}
