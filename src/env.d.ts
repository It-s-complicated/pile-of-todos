/// <reference types="vite-plus/client" />

/**
 * Frontend-only runtime contract.
 *
 * Supabase handles browser auth, confirmed reads, and RPC writes. This app
 * does not define app-owned server env vars or `/api/*` route bases.
 */
interface ImportMetaEnv {
  /** Stable browser/device identifier attached to client mutation intents. */
  readonly VITE_DEVICE_ID: string

  /** Supabase project URL used for browser auth and write calls. */
  readonly VITE_SUPABASE_URL: string

  /** Supabase publishable/anon key used by the browser client. */
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}
