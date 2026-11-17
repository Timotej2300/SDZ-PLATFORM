import { createClient } from '@/lib/supabase/server'
import { requireRegion } from '@/lib/regional'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { COMPLAINT_STATUS_LABELS, fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Podnety a sťažnosti' }

type C = { complaint_number: string; subject: string; status: string; organization: string; created_at: string }

export default async function Page() {
  const { region } = await requireRegion()
  const supabase = await createClient()
  const { data } = await supabase.rpc('regional_complaints', { p_region: region.id })
  const rows = (data ?? []) as C[]
  return (
    <div className="space-y-6">
      <PageHeader title="Podnety a sťažnosti" intro="Sťažnosti na organizácie vášho regiónu (iba predmet a stav). Sťažnosti rieši centrálny tím SDZ; totožnosť podávateľa sa nezobrazuje." />
      {rows.length === 0 ? <Empty title="Žiadne podnety" /> : (
        <Table head={['Číslo', 'Predmet', 'Organizácia', 'Stav', 'Podaná']}>
          {rows.map((c) => (
            <tr key={c.complaint_number}>
              <Td className="font-mono text-xs">{c.complaint_number}</Td><Td>{c.subject}</Td><Td>{c.organization}</Td>
              <Td><Badge tone={statusTone(c.status === 'resolved' ? 'approved' : c.status)}>{COMPLAINT_STATUS_LABELS[c.status]}</Badge></Td>
              <Td>{fmtDateTime(c.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
