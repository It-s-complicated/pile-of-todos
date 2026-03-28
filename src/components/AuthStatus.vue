<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAuth } from '@/composables/useAuth'

const { accessState, authError, displayName, isAuthenticated, signInWithGithub, signOut, user } =
  useAuth()
const isWorking = ref(false)

const signedInLabel = computed(() => displayName.value || user.value?.email || 'Approved account')

async function handleSignIn() {
  isWorking.value = true

  try {
    await signInWithGithub()
  } catch (error) {
    console.error('GitHub sign-in failed:', error)
  } finally {
    isWorking.value = false
  }
}

async function handleSignOut() {
  isWorking.value = true

  try {
    await signOut()
  } catch (error) {
    console.error('Sign-out failed:', error)
  } finally {
    isWorking.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-end gap-2 text-right">
    <p v-if="isAuthenticated" class="text-xs font-medium text-text-muted">
      Signed in as <span class="text-navy">{{ signedInLabel }}</span>
    </p>
    <p v-else class="text-xs font-medium text-text-muted">Sign in to start account sync</p>

    <div class="flex items-center gap-2">
      <button
        v-if="!isAuthenticated"
        type="button"
        class="cursor-pointer rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isWorking"
        @click="handleSignIn"
      >
        {{ isWorking ? 'Redirecting...' : 'Sign in with GitHub' }}
      </button>
      <button
        v-else
        type="button"
        class="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold text-navy transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isWorking"
        @click="handleSignOut"
      >
        {{ isWorking ? 'Signing out...' : 'Sign out' }}
      </button>
    </div>

    <p
      v-if="authError"
      class="max-w-xs rounded-lg border border-danger/20 bg-danger-light px-3 py-2 text-xs text-danger"
    >
      {{ authError }}
    </p>
    <p
      v-else-if="accessState === 'approved'"
      class="rounded-lg border border-success/20 bg-success-light px-3 py-2 text-xs text-success-dark"
    >
      Account sync is enabled for this GitHub identity.
    </p>
  </div>
</template>
