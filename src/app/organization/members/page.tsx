import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { Badge, Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'

export const metadata = { title: 'Členovia' }

type Row = { id: string; status: string; started_at: string; ended_at: string | null; volunteers: { registration_number: string; profiles: { first_name: string; last_name: string } | null } | null }

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('volunteers.read', org.id))) redirect('/organization')
  const supabase = await createClient()
  const { data } = await supabase
    .from('organization_memberships')
    .select('id,status,started_at,ended_at,volunteers(registration_number,profiles(first_name,last_name))')
    .eq('organization_id', org.id)
    .order('started_at', { ascending: false })
    .limit(500)
  const rows = (data ?? []) as unknown as Row[]
  return (
    <div className="space-y-6">
      <PageHeader title="Členovia" intro="História členstiev v organizácii (aktívne aj ukončené, napr. po prestupe)." />
      {rows.length === 0 ? (
        <Empty title="Organizácia zatiaľ nemá žiadnych členov" hint="Členstvo vznikne po schválení registrácie pozvaného dobrovoľníka." />
      ) : (
        <Table head={['Meno', 'Registračné číslo', 'Od', 'Do', 'Stav']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.volunteers?.profiles?.first_name} {r.volunteers?.profiles?.last_name}</Td>
              <Td className="font-mono">{r.volunteers?.registration_number}</Td>
              <Td>{fmtDate(r.started_at)}</Td>
              <Td>{fmtDate(r.ended_at)}</Td>
              <Td>{r.status === 'active' ? <Badge tone="green">Aktívny</Badge> : <Badge>Ukončený</Badge>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
