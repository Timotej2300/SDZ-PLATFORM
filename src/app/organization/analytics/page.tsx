import { createClient } from '@/lib/supabase/server'
import { requireOrgPermission, hasOrgPermission } from '@/lib/auth'
import { Bars, StatTile, countMap } from '@/components/Stats'
import { PageHeader } from '@/components/ui'
import { APP_STATUS_LABELS, EVENT_STATUS_LABELS } from '@/lib/labels'

export const metadata = { title: 'Štatistiky organizácie' }

type S = {
  members: number; hours_total: number; volunteers_worked: number; certificates: number
  events: Record<string, number>; applications: Record<string, number>
  events_fill: { title: string; capacity: number | null; assigned: number }[]
}

export default async function Page() {
  const org = await requireOrgPermission('analytics.view')
  const supabase = await createClient()
  const { data } = await supabase.rpc('org_stats', { p_org: org.id })
  const s = data as S | null
  const canExport = await hasOrgPermission('exports.org', org.id)
  if (!s) return <PageHeader title="Štatistiky" intro="Štatistiky sa nepodarilo načítať." />
  return (
    <div className="space-y-6">
      <PageHeader title="Štatistiky organizácie" intro="Prehľad činnosti vašej organizácie. Zahŕňa podujatia organizácie a hodiny odpracované na nich.">
        {canExport && (
          <div className="flex gap-2">
            <a className="btn-secondary" href="/organization/export/org_volunteers">Export dobrovoľníkov (CSV)</a>
            <a className="btn-secondary" href="/organization/export/org_attendance">Export dochádzky (CSV)</a>
          </div>
        )}
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Členovia" value={s.members} />
        <StatTile label="Odpracované hodiny" value={Number(s.hours_total).toLocaleString('sk-SK')} />
        <StatTile label="Zapojení dobrovoľníci" value={s.volunteers_worked} />
        <StatTile label="Vydané certifikáty" value={s.certificates} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Podujatia podľa stavu</h2><Bars items={countMap(s.events, EVENT_STATUS_LABELS)} /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Prihlášky podľa stavu</h2><Bars items={countMap(s.applications, APP_STATUS_LABELS)} /></section>
      </div>
      <section className="card">
        <h2 className="mb-3 font-semibold">Obsadenosť posledných podujatí</h2>
        {s.events_fill.length === 0 ? <p className="text-sm text-ink-600">Zatiaľ žiadne zverejnené podujatia.</p> :
          <Bars items={s.events_fill.map((e) => ({ label: e.capacity ? `${e.title} (z ${e.capacity})` : e.title, value: e.assigned }))} />}
      </section>
    </div>
  )
}
