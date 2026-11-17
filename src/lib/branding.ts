import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type Branding = { name: string; short: string; tagline: string }
const DEFAULT: Branding = { name: 'Slovenský dobrovoľnícky zväz', short: 'SDZ', tagline: 'SDZ – Jedno miesto pre všetkých, ktorí chcú pomáhať.' }

export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase.rpc('public_branding')
    const b = (data ?? {}) as Partial<Branding>
    return { name: b.name || DEFAULT.name, short: b.short || DEFAULT.short, tagline: b.tagline || DEFAULT.tagline }
  } catch {
    return DEFAULT
  }
})

export const getModules = cache(async (): Promise<Record<string, boolean>> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('system_modules').select('key,enabled')
    return Object.fromEntries(((data ?? []) as { key: string; enabled: boolean }[]).map((m) => [m.key, m.enabled]))
  } catch {
    return {}
  }
})
