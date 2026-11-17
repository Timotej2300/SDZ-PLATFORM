import { createClient } from '@/lib/supabase/server'
import { requireRegion } from '@/lib/regional'
import { Bars, StatTile, countMap } from '@/components/Stats'
import { PageHeader } from '@/components/ui'
import { EVENT_STATUS_LABELS, ORG_STATUS_LABELS } from '@/lib/labels'

export const metadata = { title: 'Región' }

export type Overview = {
  organizations: Record<string, number>; volunteers: number; valid_licenses: number; events: Record<string, number>
  hours_total: number; open_complaints: number; hours_by_month: { month: string; hours: number }[]
}

export default async function Page() {
  const { region } = await requireRegion()
  const supabase = await createClient()
  const { data } = await supabase.rpc('regional_overview', { p_region: region.id })
  const s = data as Overview | null
  if (!s) return <PageHeader title={region.name} intro="Údaje sa nepodarilo načítať." />
  const orgs = Object.values(s.organizations).reduce((a, b) => a + Number(b), 0)
  return (
    <div className="space-y-6">
      <PageHeader title={`Región: ${region.name}`} intro="Prístup iba k údajom pridelenému regiónu. Údaje pochádzajú z databázy." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Organizácie" value={orgs} />
        <StatTile label="Dobrovoľníci" value={s.volunteers} hint={`${s.valid_licenses} s platnou licenciou`} />
        <StatTile label="Odpracované hodiny" value={Number(s.hours_total).toLocaleString('sk-SK')} />
        <StatTile label="Otvorené sťažnosti" value={s.open_complaints} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Organizácie podľa stavu</h2><Bars items={countMap(s.organizations, ORG_STATUS_LABELS)} /></section>
        <section className="card"><h2 className="mb-3 font-semibold">Podujatia podľa stavu</h2><Bars items={countMap(s.events, EVENT_STATUS_LABELS)} /></section>
      </div>
    </div>
  )
}
