import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { Badge, Empty, PageHeader } from '@/components/ui'
import { APP_STATUS_LABELS, fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Kalendár' }

type A = { id: string; status: string; events: { id: string; title: string; location: string | null; starts_at: string; ends_at: string; status: string } | null }

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) return <div><PageHeader title="Kalendár" /><Empty title="Kalendár je dostupný po registrácii dobrovoľníka" /></div>
  const supabase = await createClient()
  const { data } = await supabase.from('applications')
    .select('id,status,events!inner(id,title,location,starts_at,ends_at,status)')
    .eq('volunteer_id', ctx.volunteer_id).in('status', ['submitted', 'in_review', 'needs_info', 'approved', 'assigned'])
  const rows = ((data ?? []) as unknown as A[]).filter((a) => a.events && a.events.status !== 'cancelled')
    .sort((a, b) => a.events!.starts_at.localeCompare(b.events!.starts_at))
  const now = new Date().toISOString()
  const upcoming = rows.filter((r) => r.events!.ends_at >= now)
  const byMonth = new Map<string, A[]>()
  for (const r of upcoming) {
    const m = new Intl.DateTimeFormat('sk-SK', { month: 'long', year: 'numeric', timeZone: 'Europe/Bratislava' }).format(new Date(r.events!.starts_at))
    byMonth.set(m, [...(byMonth.get(m) ?? []), r])
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Kalendár" intro="Vaše nadchádzajúce podujatia a čakajúce prihlášky.">
        <a href="/account/calendar/ics" className="btn-secondary">Stiahnuť do kalendára (.ics)</a>
      </PageHeader>
      {upcoming.length === 0 ? <Empty title="Nemáte žiadne nadchádzajúce podujatia" href="/podujatia" cta="Nájsť podujatie" /> :
        [...byMonth].map(([m, list]) => (
          <section key={m}>
            <h2 className="mb-2 font-semibold capitalize text-navy-900">{m}</h2>
            <ul className="space-y-2">
              {list.map((a) => (
                <li key={a.id} className="card flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.events!.title}</p>
                    <p className="text-sm text-ink-600">{fmtDateTime(a.events!.starts_at)} – {fmtDateTime(a.events!.ends_at)}{a.events!.location ? ` · ${a.events!.location}` : ''}</p>
                  </div>
                  <Badge tone={a.status === 'approved' || a.status === 'assigned' ? 'green' : 'blue'}>{APP_STATUS_LABELS[a.status]}</Badge>
                </li>
              ))}
            </ul>
          </section>
        ))}
      <p className="text-sm text-ink-600"><Link href="/account/applications" className="underline">Všetky prihlášky</Link></p>
    </div>
  )
}
