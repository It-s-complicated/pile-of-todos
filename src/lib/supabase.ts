import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseApiKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY

let cachedClient: ReturnType<typeof createClient<any>> | null = null

export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseApiKey
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient<any>(supabaseUrl!, supabaseApiKey!)
  }

  return cachedClient
}
