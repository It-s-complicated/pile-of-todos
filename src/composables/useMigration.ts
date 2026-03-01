import { onMounted, ref } from 'vue'
import { useElectricTodos } from './useElectricTodos'

export function useMigration() {
  const hasMigrated = ref(false)
  const hasPrompted = ref(false)
  const migrationPending = ref(false)
  const { isOnline, needsMigration, migrateLocalTodos } = useElectricTodos()

  onMounted(async () => {
    // Check if there's local data to migrate
    if (needsMigration.value && isOnline.value && !hasPrompted.value) {
      hasPrompted.value = true
      migrationPending.value = true

      // Ask user for migration after a short delay to let UI settle
      setTimeout(async () => {
        const shouldMigrate = confirm(
          `Found local todos that haven't been synced to the cloud. Upload them now?`,
        )

        if (shouldMigrate) {
          const success = await migrateLocalTodos()
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
