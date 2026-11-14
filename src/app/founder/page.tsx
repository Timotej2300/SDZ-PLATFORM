import { createClient } from '@/lib/supabase/server'
import { AuditTable } from '@/components/AuditTable'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Founder Control Center' }

export default async function Page() {
  const supabase = await createClient()
  const [stats, roles, admins] = await Promise.all([
    supabase.rpc('admin_stats'),
    supabase.from('roles').select('*', { count: 'exact', head: true }),
    supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('scope_type', 'system').is('revoked_at', null),
  ])
  const s = (stats.data ?? {}) as Record<string, number>
  const tiles: [string, number][] = [
    ['Používatelia s centrálnou rolou', admins.count ?? 0],
    ['Roly v systéme', roles.count ?? 0],
    ['Dobrovoľníci', s.volunteers ?? 0],
    ['Schválené organizácie', s.organizations ?? 0],
  ]
  return (
    <div className="space-y-6">
      <PageHeader title="Founder Control Center" intro="Systémová správa rolí, oprávnení a nastavení. Každá zmena je auditovaná." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([l, n]) => (
          <div key={l} className="card"><p className="text-sm text-ink-600">{l}</p><p className="mt-1 text-3xl font-bold text-navy-900">{n}</p></div>
        ))}
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Posledné kritické akcie</h2>
        <AuditTable basePath="/founder/audit" q="" severity="" page={0} onlyCritical />
      </section>
    </div>
  )
}
