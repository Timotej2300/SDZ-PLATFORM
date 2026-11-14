import { requirePermission } from '@/lib/auth'
import { AuditTable } from '@/components/AuditTable'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Auditné záznamy' }

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; severity?: string; page?: string }> }) {
  await requirePermission('audit.read', '/admin/audit-logs')
  const { q = '', severity = '', page = '0' } = await searchParams
  return (
    <div className="space-y-6">
      <PageHeader title="Auditné záznamy" intro="Záznamy sú nemenné – nikto ich nemôže upraviť ani odstrániť." />
      <AuditTable basePath="/admin/audit-logs" q={q} severity={severity} page={Math.max(0, parseInt(page, 10) || 0)} />
    </div>
  )
}
