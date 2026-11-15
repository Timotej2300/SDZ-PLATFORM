import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOrgPermission } from '@/lib/auth'
import { loadEventFormOptions } from '@/lib/event-options'
import { EventForm } from '@/components/EventForm'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { EVENT_STATUS_LABELS, fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Podujatia' }

type Row = { id: string; title: string; starts_at: string; ends_at: string; status: string; capacity: number | null; applications: { count: number }[] }

export default async function Page() {
  const org = await requireOrgPermission('events.manage')
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('id,title,starts_at,ends_at,status,capacity,applications(count)')
    .eq('organization_id', org.id)
    .order('starts_at', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as unknown as Row[]
  const opts = await loadEventFormOptions(org.id)
  const active = org.status === 'approved'

  return (
    <div className="space-y-8">
      <PageHeader title="Podujatia" intro="Podujatie sa po vytvorení uloží ako rozpracované. Verejne sa zobrazí až po zverejnení." />
      {!active && <p className="card">Organizácia nie je aktívna (musí byť schválená), preto nemôžete vytvárať nové podujatia.</p>}
      {rows.length === 0 ? <Empty title="Zatiaľ nemáte žiadne podujatia" /> : (
        <Table head={['Podujatie', 'Termín', 'Stav', 'Prihlášky']}>
          {rows.map((e) => (
            <tr key={e.id}>
              <Td><Link href={`/organization/events/${e.id}`} className="font-semibold text-navy-700 underline">{e.title}</Link></Td>
              <Td>{fmtDateTime(e.starts_at)} – {fmtDateTime(e.ends_at)}</Td>
              <Td><Badge tone={e.status === 'published' ? 'green' : e.status === 'cancelled' ? 'red' : statusTone('draft')}>{EVENT_STATUS_LABELS[e.status]}</Badge></Td>
              <Td>{e.applications?.[0]?.count ?? 0}{e.capacity ? ` / ${e.capacity}` : ''}</Td>
            </tr>
          ))}
        </Table>
      )}
      {active && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Nové podujatie</h2>
          <EventForm regions={opts.regions} formVersions={opts.formVersions} />
        </section>
      )}
    </div>
  )
}
