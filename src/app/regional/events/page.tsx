import { createClient } from '@/lib/supabase/server'
import { requireRegion } from '@/lib/regional'
import { Badge, Empty, PageHeader, Table, Td } from '@/components/ui'
import { EVENT_STATUS_LABELS, fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Podujatia regiónu' }

type E = { id: string; title: string; organization: string; status: string; starts_at: string; ends_at: string; capacity: number | null; assigned: number }

export default async function Page() {
  const { region } = await requireRegion()
  const supabase = await createClient()
  const { data } = await supabase.rpc('regional_events', { p_region: region.id })
  const rows = (data ?? []) as E[]
  return (
    <div className="space-y-6">
      <PageHeader title="Podujatia regiónu" />
      {rows.length === 0 ? <Empty title="Zatiaľ žiadne podujatia" /> : (
        <Table head={['Podujatie', 'Organizácia', 'Termín', 'Obsadenie', 'Stav']}>
          {rows.map((e) => (
            <tr key={e.id}>
              <Td className="font-semibold">{e.title}</Td><Td>{e.organization}</Td><Td>{fmtDateTime(e.starts_at)} – {fmtDateTime(e.ends_at)}</Td>
              <Td>{e.assigned}{e.capacity ? ` / ${e.capacity}` : ''}</Td>
              <Td><Badge tone={e.status === 'published' ? 'green' : 'red'}>{EVENT_STATUS_LABELS[e.status]}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
