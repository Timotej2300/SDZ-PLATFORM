import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function loadEventFormOptions(orgId: string) {
  const supabase = await createClient()
  const [{ data: regions }, { data: forms }] = await Promise.all([
    supabase.from('regions').select('id,name').order('name'),
    supabase.from('forms').select('id,name,form_versions(id,version)').eq('organization_id', orgId).eq('archived', false).order('name'),
  ])
  const formVersions = ((forms ?? []) as unknown as { name: string; form_versions: { id: string; version: number }[] }[]).flatMap((f) => {
    const latest = [...f.form_versions].sort((a, b) => b.version - a.version)[0]
    return latest ? [{ value: latest.id, label: `${f.name} (verzia ${latest.version})` }] : []
  })
  return { regions: (regions ?? []) as { id: string; name: string }[], formVersions }
}

/** Názvy organizácií pre verejné/dobrovoľnícke pohľady (tabuľka organizácií je pre nich nečitateľná, použije sa verejný pohľad). */
export async function orgNameMap(ids: (string | null | undefined)[]) {
  const uniq = [...new Set(ids.filter(Boolean))] as string[]
  const out = new Map<string, { name: string; slug: string }>()
  if (uniq.length === 0) return out
  const supabase = await createClient()
  const { data } = await supabase.from('public_organizations').select('id,name,slug').in('id', uniq)
  for (const o of (data ?? []) as { id: string; name: string; slug: string }[]) out.set(o.id, { name: o.name, slug: o.slug })
  return out
}
