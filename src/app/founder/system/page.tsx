import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { StatusList } from '@/components/StatusList'

export const metadata = { title: 'Stav systému' }

export default async function Page() {
  const supabase = await createClient()
  const checks = await Promise.all([
    supabase.from('roles').select('*', { count: 'exact', head: true }),
    supabase.from('permissions').select('*', { count: 'exact', head: true }),
    supabase.from('regions').select('*', { count: 'exact', head: true }),
    supabase.from('volunteers').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
  ])
  const [roles, perms, regions, vols, orgs] = checks
  const dbOk = checks.every((c) => !c.error)
  return (
    <div className="space-y-6">
      <PageHeader title="Stav systému" />
      <StatusList items={[
        { label: 'Pripojenie na databázu a schéma', ok: dbOk },
        { label: `Roly: ${roles.count ?? 0}, oprávnenia: ${perms.count ?? 0}`, ok: (roles.count ?? 0) > 0 && (perms.count ?? 0) > 0 },
        { label: `Regióny: ${regions.count ?? 0}`, ok: (regions.count ?? 0) > 0 },
        { label: `Dobrovoľníci: ${vols.count ?? 0}, organizácie: ${orgs.count ?? 0}`, ok: null },
        { label: 'Verzia aplikácie', ok: null, detail: process.env.VERCEL_GIT_COMMIT_SHA ? `commit ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : 'lokálne prostredie' },
      ]} />
    </div>
  )
}
