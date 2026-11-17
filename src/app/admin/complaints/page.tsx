import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { COMPLAINT_STATUS_LABELS, COMPLAINT_TARGET_LABELS, fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Sťažnosti' }

type C = { id: string; complaint_number: string; subject: string; status: string; target_type: string; created_at: string }

export default async function Page({ searchParams }: { searchParams: Promise<{ stav?: string }> }) {
  await requirePermission('complaints.read', '/admin/complaints')
  const { stav } = await searchParams
  const supabase = await createClient()
  let q = supabase.from('complaints').select('id,complaint_number,subject,status,target_type,created_at').order('created_at', { ascending: false }).limit(300)
  if (stav && COMPLAINT_STATUS_LABELS[stav]) q = q.eq('status', stav)
  const { data } = await q
  const rows = (data ?? []) as C[]
  return (
    <div className="space-y-6">
      <PageHeader title="Sťažnosti" intro="Sťažnosti riešia centrálne role. Vlastnú sťažnosť nemôžete riešiť.">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/complaints" className="btn-secondary">Všetky</Link>
          {['new', 'in_review', 'needs_info', 'resolved'].map((s) => <Link key={s} href={`/admin/complaints?stav=${s}`} className="btn-secondary">{COMPLAINT_STATUS_LABELS[s]}</Link>)}
        </div>
      </PageHeader>
      {rows.length === 0 ? <Empty title="Žiadne sťažnosti" /> : (
        <Table head={['Číslo', 'Predmet', 'Týka sa', 'Stav', 'Podaná']}>
          {rows.map((c) => (
            <tr key={c.id}>
              <Td><Link href={`/admin/complaints/${c.id}`} className="font-semibold underline">{c.complaint_number}</Link></Td>
              <Td>{c.subject}</Td><Td>{COMPLAINT_TARGET_LABELS[c.target_type]}</Td>
              <Td><Badge tone={statusTone(c.status === 'resolved' ? 'approved' : c.status)}>{COMPLAINT_STATUS_LABELS[c.status]}</Badge></Td>
              <Td>{fmtDateTime(c.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
