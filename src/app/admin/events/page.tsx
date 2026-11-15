import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { Badge, Empty, PageHeader, Table, Td } from '@/components/ui'
import { EVENT_STATUS_LABELS, fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Podujatia' }

type E = { id: string; title: string; status: string; starts_at: string; ends_at: string; capacity: number | null; organizations: { name: string } | null; applications: { count: number }[] }

export default async function Page() {
  await requirePermission('events.read', '/admin/events')
  const supabase = await createClient()
  const { data } = await supabase.from('events')
    .select('id,title,status,starts_at,ends_at,capacity,organizations(name),applications(count)')
    .order('starts_at', { ascending: false }).limit(300)
  const rows = (data ?? []) as unknown as E[]
  return (
    <div className="space-y-6">
      <PageHeader title="Podujatia" intro="Prehľad všetkých podujatí organizácií (iba na čítanie)." />
      {rows.length === 0 ? <Empty title="Zatiaľ žiadne podujatia" /> : (
        <Table head={['Podujatie', 'Organizácia', 'Termín', 'Stav', 'Prihlášky']}>
          {rows.map((e) => (
            <tr key={e.id}>
              <Td className="font-semibold">{e.title}</Td>
              <Td>{e.organizations?.name}</Td>
              <Td>{fmtDateTime(e.starts_at)} – {fmtDateTime(e.ends_at)}</Td>
              <Td><Badge tone={e.status === 'published' ? 'green' : e.status === 'cancelled' ? 'red' : 'gray'}>{EVENT_STATUS_LABELS[e.status]}</Badge></Td>
              <Td>{e.applications?.[0]?.count ?? 0}{e.capacity ? ` / ${e.capacity}` : ''}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
