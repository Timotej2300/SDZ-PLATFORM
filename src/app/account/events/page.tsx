import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { Empty, PageHeader } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'
import { orgNameMap } from '@/lib/event-options'

export const metadata = { title: 'Moje podujatia' }

type A = {
  id: string; status: string
  events: { id: string; title: string; slug: string; location: string | null; starts_at: string; ends_at: string; status: string; organization_id: string } | null
  event_teams: { name: string } | null; event_positions: { name: string } | null
}
type Sh = { application_id: string; event_shifts: { starts_at: string; ends_at: string; note: string | null } | null }

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) return <div><PageHeader title="Moje podujatia" /><Empty title="Podujatia sú dostupné po registrácii dobrovoľníka" /></div>
  const supabase = await createClient()
  const { data } = await supabase.from('applications')
    .select('id,status,events(id,title,slug,location,starts_at,ends_at,status,organization_id),event_teams(name),event_positions(name)')
    .eq('volunteer_id', ctx.volunteer_id).eq('status', 'assigned')
  const apps = ((data ?? []) as unknown as A[]).filter((a) => a.events && a.events.status !== 'cancelled')
    .sort((a, b) => (a.events!.starts_at < b.events!.starts_at ? -1 : 1))
  const ids = apps.map((a) => a.id)
  const orgs = await orgNameMap(apps.map((a) => a.events?.organization_id))
  const { data: sh } = ids.length
    ? await supabase.from('shift_assignments').select('application_id,event_shifts(starts_at,ends_at,note)').in('application_id', ids)
    : { data: [] }
  const shifts = (sh ?? []) as unknown as Sh[]

  return (
    <div className="space-y-6">
      <PageHeader title="Moje podujatia" intro="Podujatia, na ktoré ste boli zaradený." >
        <Link href="/podujatia" className="btn-secondary">Zoznam podujatí</Link>
      </PageHeader>
      {apps.length === 0 ? <Empty title="Zatiaľ nie ste zaradený na žiadne podujatie" hint="Po schválení prihlášky a zaradení sa podujatie zobrazí tu." href="/podujatia" cta="Nájsť podujatie" /> : (
        <div className="space-y-4">
          {apps.map((a) => (
            <article key={a.id} className="card">
              <h2 className="font-semibold">{a.events!.title}</h2>
              <p className="text-sm text-ink-600">{orgs.get(a.events!.organization_id)?.name} · {fmtDateTime(a.events!.starts_at)} – {fmtDateTime(a.events!.ends_at)}{a.events!.location ? ` · ${a.events!.location}` : ''}</p>
              <p className="mt-2 text-sm">Tím: <b>{a.event_teams?.name ?? '—'}</b> · Pozícia: <b>{a.event_positions?.name ?? '—'}</b></p>
              {shifts.filter((s) => s.application_id === a.id).length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {shifts.filter((s) => s.application_id === a.id).sort((x, y) => (x.event_shifts!.starts_at < y.event_shifts!.starts_at ? -1 : 1)).map((s, i) => (
                    <li key={i}>{fmtDateTime(s.event_shifts?.starts_at)} – {fmtDateTime(s.event_shifts?.ends_at)}{s.event_shifts?.note ? ` (${s.event_shifts.note})` : ''}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
