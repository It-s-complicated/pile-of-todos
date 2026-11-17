import './lib/env'
import { createApp } from 'vue'

// `vp run dev:mock`: swap Supabase for an in-browser mock before any client is created.
if (import.meta.env.MODE === 'mock') {
  const { startMockBackend } = await import('./mocks/browser')
  await startMockBackend()
}

const [{ default: App }, { router }] = await Promise.all([import('./App.vue'), import('./router')])

const app = createApp(App)
app.use(router)
app.mount('#app')
