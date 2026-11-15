import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'
import { orgNameMap } from '@/lib/event-options'

export const metadata = { title: 'História činnosti' }

type R = { event_id: string; hours: number }
type E = { id: string; title: string; starts_at: string; organization_id: string }

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) return <div><PageHeader title="História dobrovoľníckej činnosti" /><Empty title="História je dostupná po registrácii dobrovoľníka" /></div>
  const supabase = await createClient()
  const { data } = await supabase.from('volunteer_hours').select('event_id,hours').eq('volunteer_id', ctx.volunteer_id).limit(1000)
  const perEvent = new Map<string, number>()
  for (const r of (data ?? []) as R[]) perEvent.set(r.event_id, (perEvent.get(r.event_id) ?? 0) + Number(r.hours))
  const ids = [...perEvent.keys()]
  const { data: ev } = ids.length ? await supabase.from('events').select('id,title,starts_at,organization_id').in('id', ids) : { data: [] }
  const events = ((ev ?? []) as unknown as E[]).sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))
  const orgs = await orgNameMap(events.map((e) => e.organization_id))
  return (
    <div className="space-y-6">
      <PageHeader title="História dobrovoľníckej činnosti" intro="Podujatia, na ktorých máte zapísanú dochádzku." />
      {events.length === 0 ? <Empty title="Zatiaľ nemáte žiadnu históriu" /> : (
        <Table head={['Podujatie', 'Organizácia', 'Dátum', 'Hodiny']}>
          {events.map((e) => (
            <tr key={e.id}>
              <Td className="font-semibold">{e.title}</Td>
              <Td>{orgs.get(e.organization_id)?.name}</Td>
              <Td>{fmtDate(e.starts_at)}</Td>
              <Td>{(perEvent.get(e.id) ?? 0).toFixed(2)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
