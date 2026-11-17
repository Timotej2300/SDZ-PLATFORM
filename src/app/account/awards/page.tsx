import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { Empty, PageHeader } from '@/components/ui'
import { fmtDate } from '@/lib/labels'

export const metadata = { title: 'Ocenenia' }

type A = { id: string; granted_at: string; note: string | null; award_types: { name: string; description: string | null } | null }

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) return <div><PageHeader title="Ocenenia" /><Empty title="Ocenenia sú dostupné po registrácii dobrovoľníka" /></div>
  const supabase = await createClient()
  const { data } = await supabase.from('volunteer_awards').select('id,granted_at,note,award_types(name,description)')
    .eq('volunteer_id', ctx.volunteer_id).is('revoked_at', null).order('granted_at', { ascending: false })
  const rows = (data ?? []) as unknown as A[]
  return (
    <div className="space-y-6">
      <PageHeader title="Ocenenia SDZ" intro="Ocenenia udeľuje SDZ ručne. Automatické bodovanie ani kritériá zatiaľ neexistujú." />
      {rows.length === 0 ? <Empty title="Zatiaľ nemáte žiadne ocenenie" /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((a) => (
            <li key={a.id} className="card">
              <p className="font-semibold">{a.award_types?.name}</p>
              {a.award_types?.description && <p className="text-sm text-ink-600">{a.award_types.description}</p>}
              {a.note && <p className="mt-1 text-sm">{a.note}</p>}
              <p className="mt-1 text-xs text-ink-600">Udelené {fmtDate(a.granted_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
