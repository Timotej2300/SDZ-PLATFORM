import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS } from '@/lib/labels'

export const metadata = { title: 'Organizácie' }

type Row = { id: string; org_number: string | null; name: string; type: string; status: string; regions: { name: string } | null }

export default async function Page({ searchParams }: { searchParams: Promise<{ stav?: string }> }) {
  await requirePermission('orgs.read', '/admin/organizations')
  const { stav = '' } = await searchParams
  const supabase = await createClient()
  let query = supabase.from('organizations').select('id,org_number,name,type,status,regions(name)').order('name').limit(300)
  if (Object.keys(ORG_STATUS_LABELS).includes(stav)) query = query.eq('status', stav)
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]
  return (
    <div className="space-y-6">
      <PageHeader title="Organizácie" />
      <form className="flex gap-3">
        <select name="stav" defaultValue={stav} className="input max-w-xs" aria-label="Stav">
          <option value="">Všetky stavy</option>
          {Object.entries(ORG_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-primary" type="submit">Filtrovať</button>
      </form>
      {rows.length === 0 ? <Empty title="Žiadne organizácie" /> : (
        <Table head={['Číslo', 'Názov', 'Typ', 'Kraj', 'Stav']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="font-mono">{r.org_number ?? '—'}</Td>
              <Td>{r.name}</Td>
              <Td>{ORG_TYPE_LABELS[r.type]}</Td>
              <Td>{r.regions?.name ?? '—'}</Td>
              <Td><Badge tone={statusTone(r.status)}>{ORG_STATUS_LABELS[r.status]}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
