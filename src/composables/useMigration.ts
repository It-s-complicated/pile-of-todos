import { onMounted, ref } from 'vue'
import { useElectricTodos } from './useElectricTodos'

export function useMigration() {
  const hasMigrated = ref(false)
  const hasPrompted = ref(false)
  const migrationPending = ref(false)
  const { isOnline, needsSync, syncTodos } = useElectricTodos()

  onMounted(async () => {
    if (needsSync.value && isOnline.value && !hasPrompted.value) {
      hasPrompted.value = true
      migrationPending.value = true

      setTimeout(async () => {
        // eslint-disable-next-line no-alert
        const shouldMigrate = confirm(`Local changes need to be synchronized. Retry sync now?`)

        if (shouldMigrate) {
          const success = await syncTodos()
          if (success) {
            hasMigrated.value = true
          }
        }
        migrationPending.value = false
      }, 1000)
    }
  })

  return {
    hasMigrated,
    hasPrompted,
    migrationPending,
  }
}
