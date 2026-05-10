<script setup lang="ts">
import { CircleUserRound, Github, LogOut } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { useAuth } from '@/composables/useAuth'

withDefaults(
  defineProps<{
    showDetailsOnMobile?: boolean
  }>(),
  {
    showDetailsOnMobile: false,
  },
)

const { authError, displayName, isAuthenticated, signInWithGithub, signOut, user } = useAuth()
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
  <div class="flex flex-col gap-2">
    <div
      class="flex items-center gap-3 rounded-3xl border border-outline-variant/10 bg-surface-container/80 px-4 py-3 text-left shadow-surface-rest backdrop-blur-xl"
    >
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-primary"
      >
        <CircleUserRound class="size-5" stroke-width="1.8" />
      </div>

      <div :class="showDetailsOnMobile ? 'block min-w-0 sm:block' : 'hidden min-w-0 sm:block'">
        <p class="text-tiny font-semibold tracking-label-wider text-on-surface-variant uppercase">
          Personal
        </p>
        <p v-if="isAuthenticated" class="truncate text-supporting text-on-surface">
          Signed in as <span class="text-primary">{{ signedInLabel }}</span>
        </p>
        <p v-else class="text-supporting text-on-surface">Sign in to start account sync</p>
      </div>

      <button
        v-if="!isAuthenticated"
        type="button"
        class="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 py-2 text-caption font-semibold text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-primary-lift active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        :disabled="isWorking"
        @click="handleSignIn"
      >
        <Github class="size-3.5" stroke-width="2" aria-hidden />
        <span>{{ isWorking ? 'Redirecting...' : 'Sign in' }}</span>
      </button>

      <button
        v-else
        type="button"
        class="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container-highest px-4 py-2 text-caption font-semibold text-on-surface transition-all duration-200 hover:bg-surface-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isWorking"
        @click="handleSignOut"
      >
        <LogOut class="size-3.5" stroke-width="2" aria-hidden />
        <span>{{ isWorking ? 'Signing out...' : 'Sign out' }}</span>
      </button>
    </div>

    <p
      v-if="authError"
      class="rounded-2xl border border-error/20 bg-error-container/20 px-3 py-2 text-caption text-on-error-container"
    >
      {{ authError }}
    </p>
  </div>
</template>
