import { createClient } from '@/lib/supabase/server'
import { requireRegion } from '@/lib/regional'
import { Bars, StatTile } from '@/components/Stats'
import { PageHeader } from '@/components/ui'
import type { Overview } from '../page'

export const metadata = { title: 'Regionálne štatistiky' }

export default async function Page() {
  const { region } = await requireRegion()
  const supabase = await createClient()
  const { data } = await supabase.rpc('regional_overview', { p_region: region.id })
  const s = data as Overview | null
  if (!s) return <PageHeader title="Štatistiky" intro="Údaje sa nepodarilo načítať." />
  return (
    <div className="space-y-6">
      <PageHeader title={`Štatistiky: ${region.name}`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Dobrovoľníci" value={s.volunteers} />
        <StatTile label="S platnou licenciou" value={s.valid_licenses} />
        <StatTile label="Hodiny spolu" value={Number(s.hours_total).toLocaleString('sk-SK')} />
      </div>
      <section className="card">
        <h2 className="mb-3 font-semibold">Hodiny po mesiacoch (12 mes.)</h2>
        {s.hours_by_month.length ? <Bars items={s.hours_by_month.map((m) => ({ label: m.month, value: Number(m.hours) }))} unit=" h" /> : <p className="text-sm text-ink-600">Zatiaľ žiadne hodiny.</p>}
      </section>
    </div>
  )
}
