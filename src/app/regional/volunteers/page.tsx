import { createClient } from '@/lib/supabase/server'
import { requireRegion } from '@/lib/regional'
import { Badge, Empty, PageHeader, Table, Td, licenseTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, fmtDate } from '@/lib/labels'

export const metadata = { title: 'Dobrovoľníci regiónu' }

type V = { registration_number: string; full_name: string; organization: string; license_status: string | null; license_expires: string | null }

export default async function Page() {
  const { region } = await requireRegion()
  const supabase = await createClient()
  const { data } = await supabase.rpc('regional_volunteers', { p_region: region.id })
  const rows = (data ?? []) as V[]
  return (
    <div className="space-y-6">
      <PageHeader title="Dobrovoľníci regiónu" intro="Dobrovoľníci, ktorých domovská organizácia pôsobí vo vašom regióne. Zobrazujú sa iba nevyhnutné údaje." />
      {rows.length === 0 ? <Empty title="Zatiaľ žiadni dobrovoľníci" /> : (
        <Table head={['Reg. číslo', 'Meno', 'Domovská organizácia', 'Licencia', 'Platná do']}>
          {rows.map((v) => (
            <tr key={v.registration_number}>
              <Td className="font-mono text-xs">{v.registration_number}</Td><Td>{v.full_name}</Td><Td>{v.organization}</Td>
              <Td>{v.license_status ? <Badge tone={licenseTone(v.license_status)}>{LICENSE_STATUS_LABELS[v.license_status]}</Badge> : '—'}</Td>
              <Td>{v.license_expires ? fmtDate(v.license_expires) : '—'}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
