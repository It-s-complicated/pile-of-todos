import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { StorageSerializers, useSessionStorage } from '@vueuse/core'

import { getSharedTodoLabel } from '@/lib/shared-todo'

type SharedTodoDraft = { label: string; weekNumber: number | null }

export function useSharedTodoDraft() {
  const route = useRoute()
  const router = useRouter()
  const sharedDraft = useSessionStorage<SharedTodoDraft | null>(
    'pile-of-todos-shared-draft',
    null,
    {
      serializer: StorageSerializers.object,
      flush: 'sync',
    },
  )

  watch(
    () => route.query,
    (query) => {
      const label = getSharedTodoLabel(query)
      if (!label) return

      sharedDraft.value = { label, weekNumber: null }
      const remainingQuery = { ...query }
      for (const key of ['share_title', 'share_text', 'share_url']) delete remainingQuery[key]
      void router.replace({ query: remainingQuery, hash: route.hash })
    },
    { immediate: true },
  )

  function clearSharedDraft() {
    sharedDraft.value = null
  }

  return { sharedDraft, clearSharedDraft }
}
