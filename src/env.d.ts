/// <reference types="vite-plus/client" />

/**
 * Frontend-only runtime contract.
 *
 * This app does not define app-owned server env vars, `/api/*` route bases,
 * or Electric proxy configuration. Browser auth/writes go to Supabase and
 * browser read sync goes directly to Electric via the shape URL below.
 */
interface ImportMetaEnv {
  /** Electric read/sync endpoint used directly by the browser client. */
  readonly VITE_ELECTRIC_SHAPE_URL: string

  /** Electric Cloud source identifier for the browser read endpoint. */
  readonly VITE_ELECTRIC_SOURCE_ID: string

  /** Electric Cloud secret paired with the source identifier. */
  readonly VITE_ELECTRIC_SECRET: string

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
