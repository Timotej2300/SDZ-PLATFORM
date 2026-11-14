import { AuditTable } from '@/components/AuditTable'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Systémový audit' }

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; severity?: string; page?: string }> }) {
  const { q = '', severity = '', page = '0' } = await searchParams
  return (
    <div className="space-y-6">
      <PageHeader title="Kompletný systémový audit" intro="Nemenné záznamy o zmenách rolí, nastavení, licencií, prestupov a ďalších kritických operáciách." />
      <AuditTable basePath="/founder/audit" q={q} severity={severity} page={Math.max(0, parseInt(page, 10) || 0)} />
    </div>
  )
}
