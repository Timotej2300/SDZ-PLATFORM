import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Service role: iba v serverovom kóde (cron, verejná karta, Founder operácie). Obchádza RLS. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY nie je nastavený')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
