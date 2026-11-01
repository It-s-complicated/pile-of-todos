import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as v from 'valibot'

import { getSharedTodoLabel } from '@/lib/shared-todo'

const STORAGE_KEY = 'pile-of-todos-shared-drafts'
const sharedDraftSchema = v.object({
  source: v.string(),
  // Keep long shares intact so the user can edit them down before saving.
  label: v.string(),
  weekNumber: v.nullable(v.number()),
})
type SharedTodoDraft = v.InferOutput<typeof sharedDraftSchema>

export function useSharedTodoDraft() {
  const route = useRoute()
  const router = useRouter()
  const persistenceError = ref(false)
  const drafts = ref<SharedTodoDraft[]>(readDrafts())
  const sharedDraft = computed(() => drafts.value[0] ?? null)

  function readDrafts(): SharedTodoDraft[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY)
      if (!stored) return []
      const result = v.safeParse(v.array(sharedDraftSchema), JSON.parse(stored))
      return result.success ? result.output : []
    } catch {
      persistenceError.value = true
      return []
    }
  }

  function persistDrafts() {
    if (typeof window === 'undefined') return

    try {
      if (drafts.value.length) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value))
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY)
      }
      persistenceError.value = false
    } catch {
      persistenceError.value = true
    }
  }

  async function clearShareQuery() {
    if (
      !route.query ||
      !['share_title', 'share_text', 'share_url'].some((key) => key in route.query)
    )
      return

    const query = { ...route.query }
    for (const key of ['share_title', 'share_text', 'share_url']) delete query[key]
    await router.replace({ query, hash: route.hash })
  }

  watch(drafts, persistDrafts, { deep: true, flush: 'sync' })
  watch(
    () => route.query,
    (query) => {
      const label = getSharedTodoLabel(query ?? {})
      if (!label || typeof window === 'undefined') return

      // Preserve edits on reload and queue later shares without replacing a draft.
      if (!drafts.value.some((draft) => draft.source === label)) {
        drafts.value.push({ source: label, label, weekNumber: null })
      }
      persistDrafts()
      // Remove shared content from URLs before authentication redirects.
      if (!persistenceError.value) void clearShareQuery()
    },
    { immediate: true },
  )

  function removeSharedDraft(draft: SharedTodoDraft | null = sharedDraft.value) {
    const index = draft ? drafts.value.indexOf(draft) : -1
    if (index !== -1) drafts.value.splice(index, 1)
    void clearShareQuery()
  }

  return {
    sharedDraft,
    sharedDraftCount: computed(() => drafts.value.length),
    persistenceError,
    removeSharedDraft,
  }
}
