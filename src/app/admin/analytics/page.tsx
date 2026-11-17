import { createClient } from '@/lib/supabase/server'
import { hasPermission, requirePermission } from '@/lib/auth'
import { Bars, StatTile, countMap } from '@/components/Stats'
import { PageHeader } from '@/components/ui'
import { APP_STATUS_LABELS, EVENT_STATUS_LABELS, ORG_STATUS_LABELS } from '@/lib/labels'

export const metadata = { title: 'Štatistiky' }

type S = {
  volunteers: { total: number; active: number; with_valid_license: number }
  licenses_expiring_90d: number; hours_total: number; certificates: number
  organizations: Record<string, number>; events: Record<string, number>; applications: Record<string, number>
  hours_by_month: { month: string; hours: number }[]
  orgs_by_region: { region: string; count: number }[]
  top_organizations: { name: string; hours: number }[]
}

export default async function Page() {
  await requirePermission('analytics.read', '/admin/analytics')
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_analytics')
  const s = data as S | null
  const canExport = await hasPermission('exports.run')
  if (!s) return <PageHeader title="Štatistiky" intro="Štatistiky sa nepodarilo načítať." />
  return (
    <div className="space-y-6">
      <PageHeader title="Štatistiky SDZ" intro="Agregované údaje bez osobných údajov dobrovoľníkov.">
        {canExport && (
          <div className="flex gap-2">
            <a className="btn-secondary" href="/admin/export/central_organizations">Export organizácií (CSV)</a>
            <a className="btn-secondary" href="/admin/export/central_events">Export podujatí (CSV)</a>
          </div>
        )}
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Dobrovoľníci" value={s.volunteers.total} hint={`${s.volunteers.active} aktívnych`} />
        <StatTile label="S platnou licenciou" value={s.volunteers.with_valid_license} hint={`${s.licenses_expiring_90d} expiruje do 90 dní`} />
        <StatTile label="Odpracované hodiny" value={Number(s.hours_total).toLocaleString('sk-SK')} />
        <StatTile label="Platné certifikáty" value={s.certificates} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card"><h2 className="mb-3 font-semibold">Organizácie</h2><Bars items={countMap(s.organizations, ORG_STATUS_LABELS)} /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Podujatia</h2><Bars items={countMap(s.events, EVENT_STATUS_LABELS)} /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Prihlášky</h2><Bars items={countMap(s.applications, APP_STATUS_LABELS)} /></section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Hodiny po mesiacoch (12 mes.)</h2>
          {s.hours_by_month.length ? <Bars items={s.hours_by_month.map((m) => ({ label: m.month, value: Number(m.hours) }))} unit=" h" /> : <p className="text-sm text-ink-600">Zatiaľ žiadne hodiny.</p>}</section>
        <section className="card"><h2 className="mb-3 font-semibold">Schválené organizácie podľa regiónu</h2>
          {s.orgs_by_region.length ? <Bars items={s.orgs_by_region.map((r) => ({ label: r.region, value: r.count }))} /> : <p className="text-sm text-ink-600">Žiadne údaje.</p>}</section>
      </div>
      <section className="card"><h2 className="mb-3 font-semibold">Organizácie s najviac odpracovanými hodinami</h2>
        {s.top_organizations.length ? <Bars items={s.top_organizations.map((o) => ({ label: o.name, value: Number(o.hours) }))} unit=" h" /> : <p className="text-sm text-ink-600">Zatiaľ žiadne hodiny.</p>}</section>
    </div>
  )
}
