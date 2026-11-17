import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireRegion } from '@/lib/regional'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS } from '@/lib/labels'

export const metadata = { title: 'Organizácie regiónu' }

type O = { id: string; org_number: string | null; name: string; status: string; type: string; district: string | null; members: number; events: number }

export default async function Page() {
  const { region } = await requireRegion()
  const supabase = await createClient()
  const { data } = await supabase.rpc('regional_organizations', { p_region: region.id })
  const rows = (data ?? []) as O[]
  return (
    <div className="space-y-6">
      <PageHeader title="Organizácie regiónu" intro="Schválené a pozastavené organizácie vo vašom regióne." />
      {rows.length === 0 ? <Empty title="V regióne zatiaľ nie sú schválené organizácie" /> : (
        <Table head={['Číslo', 'Organizácia', 'Typ', 'Okres', 'Členovia', 'Podujatia', 'Stav']}>
          {rows.map((o) => (
            <tr key={o.id}>
              <Td className="font-mono text-xs">{o.org_number}</Td>
              <Td><Link href={`/regional/organizations/${o.id}`} className="font-semibold underline">{o.name}</Link></Td>
              <Td>{ORG_TYPE_LABELS[o.type]}</Td><Td>{o.district ?? '—'}</Td><Td>{o.members}</Td><Td>{o.events}</Td>
              <Td><Badge tone={statusTone(o.status)}>{ORG_STATUS_LABELS[o.status]}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
