import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Odpracované hodiny' }

type H = { attendance_id: string; checked_in_at: string; checked_out_at: string; hours: number; event_id: string }

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) return <div><PageHeader title="Odpracované hodiny" /><Empty title="Hodiny sú dostupné po registrácii dobrovoľníka" /></div>
  const supabase = await createClient()
  const { data } = await supabase.from('volunteer_hours').select('attendance_id,checked_in_at,checked_out_at,hours,event_id')
    .eq('volunteer_id', ctx.volunteer_id).order('checked_in_at', { ascending: false }).limit(500)
  const rows = (data ?? []) as H[]
  const ids = [...new Set(rows.map((r) => r.event_id))]
  const { data: ev } = ids.length ? await supabase.from('events').select('id,title').in('id', ids) : { data: [] }
  const title = new Map(((ev ?? []) as { id: string; title: string }[]).map((e) => [e.id, e.title]))
  const total = rows.reduce((s, r) => s + Number(r.hours), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Odpracované hodiny" intro="Hodiny sa počítajú z dochádzky zapísanej organizátorom. Započítané sú iba záznamy s príchodom aj odchodom." />
      <p className="card text-lg">Spolu: <b>{total.toFixed(2)} hodín</b></p>
      {rows.length === 0 ? <Empty title="Zatiaľ nemáte zapísané žiadne hodiny" /> : (
        <Table head={['Podujatie', 'Príchod', 'Odchod', 'Hodiny']}>
          {rows.map((r) => (
            <tr key={r.attendance_id}>
              <Td>{title.get(r.event_id) ?? '—'}</Td>
              <Td>{fmtDateTime(r.checked_in_at)}</Td>
              <Td>{fmtDateTime(r.checked_out_at)}</Td>
              <Td>{Number(r.hours).toFixed(2)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
