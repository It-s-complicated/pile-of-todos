import { nextTick } from 'vue'

export function focusAfterUpdate(getTarget: () => HTMLElement | null): void {
  void nextTick(() => getTarget()?.focus())
}
