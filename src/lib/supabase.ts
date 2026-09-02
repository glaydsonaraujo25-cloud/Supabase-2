import { createClient } from '@supabase/supabase-js'

type ViteEnv = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SITE_URL?: string
}

const env = (import.meta as ImportMeta & { env: ViteEnv }).env
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.')
}

export const siteUrl = (env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
export const supabase = createClient(supabaseUrl, supabaseKey)
