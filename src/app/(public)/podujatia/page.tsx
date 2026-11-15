import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Empty, PageHeader } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'
import { orgNameMap } from '@/lib/event-options'

export const metadata: Metadata = { title: 'Podujatia' }
export const dynamic = 'force-dynamic'

type Ev = { slug: string; title: string; location: string | null; starts_at: string; ends_at: string; capacity: number | null; organization_id: string; regions: { name: string } | null }

export default async function Page({ searchParams }: { searchParams: Promise<{ kraj?: string }> }) {
  const { kraj = '' } = await searchParams
  const supabase = await createClient()
  const { data: regions } = await supabase.from('regions').select('id,name').order('name')
  let q = supabase.from('events')
    .select('slug,title,location,starts_at,ends_at,capacity,organization_id,regions(name)')
    .eq('status', 'published').gte('ends_at', new Date().toISOString()).order('starts_at').limit(200)
  if (/^[0-9a-f-]{36}$/.test(kraj)) q = q.eq('region_id', kraj)
  const { data } = await q
  const events = (data ?? []) as unknown as Ev[]
  const orgs = await orgNameMap(events.map((e) => e.organization_id))
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader title="Podujatia" intro="Dobrovoľnícke podujatia schválených organizácií. Na prihlásenie potrebujete platnú SDZ licenciu." />
      <form className="mb-6 flex flex-wrap gap-3" role="search">
        <select name="kraj" defaultValue={kraj} className="input max-w-xs" aria-label="Kraj">
          <option value="">Všetky kraje</option>
          {(regions ?? []).map((r: { id: string; name: string }) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn-primary" type="submit">Filtrovať</button>
      </form>
      {events.length === 0 ? <Empty title="Zatiaľ nie sú zverejnené žiadne podujatia" /> : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.slug} className="card">
              <Link href={`/podujatia/${e.slug}`} className="text-lg font-semibold text-navy-700 underline">{e.title}</Link>
              <p className="mt-1 text-sm text-ink-600">{orgs.get(e.organization_id)?.name}</p>
              <p className="mt-2 text-sm">{fmtDateTime(e.starts_at)} – {fmtDateTime(e.ends_at)}</p>
              <p className="text-sm text-ink-600">{[e.location, e.regions?.name].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
