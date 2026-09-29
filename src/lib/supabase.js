import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim()

export function getAuthRedirectUrl() {
  const origin = configuredAppUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${origin.replace(/\/+$/, '')}/`
}

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
