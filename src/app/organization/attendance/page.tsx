import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOrgPermission } from '@/lib/auth'
import { Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Dochádzka' }

export default async function Page() {
  const org = await requireOrgPermission('attendance.write', 'certificates.issue')
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('id,title,starts_at,ends_at')
    .eq('organization_id', org.id).eq('status', 'published').order('starts_at', { ascending: false }).limit(100)
  const events = (data ?? []) as { id: string; title: string; starts_at: string; ends_at: string }[]
  const now = Date.now()
  const label = (e: { starts_at: string; ends_at: string }) =>
    new Date(e.ends_at).getTime() < now ? 'Skončené' : new Date(e.starts_at).getTime() <= now ? 'Prebieha' : 'Pripravované'

  return (
    <div className="space-y-6">
      <PageHeader title="Dochádzka" intro="Dochádzka sa zapisuje ručne k pracovnej zmene. Každá oprava vyžaduje dôvod a ukladá sa do histórie." />
      {events.length === 0 ? <Empty title="Žiadne zverejnené podujatia" /> : (
        <Table head={['Podujatie', 'Termín', 'Stav', '']}>
          {events.map((e) => (
            <tr key={e.id}>
              <Td className="font-semibold">{e.title}</Td>
              <Td>{fmtDateTime(e.starts_at)} – {fmtDateTime(e.ends_at)}</Td>
              <Td>{label(e)}</Td>
              <Td><Link className="text-navy-700 underline" href={`/organization/attendance/${e.id}`}>Otvoriť</Link></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
