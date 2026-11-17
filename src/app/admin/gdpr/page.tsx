import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { DecisionForm } from '@/components/DecisionForm'
import { Badge, Empty, PageHeader } from '@/components/ui'
import { DATA_KIND_LABELS, fmtDate } from '@/lib/labels'
import { handleDataRequest } from '@/actions/oversight'

export const metadata = { title: 'Ochrana údajov' }

type D = { id: string; user_id: string; kind: string; note: string | null; status: string; created_at: string; due_at: string; resolution: string | null }

export default async function Page() {
  await requirePermission('gdpr.manage', '/admin/gdpr')
  const supabase = await createClient()
  const { data } = await supabase.from('data_requests').select('id,user_id,kind,note,status,created_at,due_at,resolution').order('status').order('created_at', { ascending: false }).limit(200)
  const rows = (data ?? []) as D[]
  const ids = [...new Set(rows.map((r) => r.user_id))]
  const { data: pr } = ids.length ? await supabase.from('profiles').select('id,first_name,last_name,email').in('id', ids) : { data: [] }
  const who = new Map(((pr ?? []) as { id: string; first_name: string; last_name: string; email: string }[]).map((p) => [p.id, `${p.first_name} ${p.last_name} (${p.email})`]))
  const now = Date.now()
  return (
    <div className="space-y-6">
      <PageHeader title="Žiadosti o osobné údaje" intro="Lehota na vybavenie je 30 dní. Vymazanie sa posudzuje individuálne – zákonne uchovávané záznamy (licencie, audit, hodiny) sa nemažú. Vlastnú žiadosť nemôžete vybaviť sami." />
      {rows.length === 0 ? <Empty title="Žiadne žiadosti" /> : rows.map((r) => (
        <article key={r.id} className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{DATA_KIND_LABELS[r.kind]} · {who.get(r.user_id) ?? '—'}</p>
            <Badge tone={r.status === 'done' ? 'green' : r.status === 'rejected' ? 'red' : new Date(r.due_at).getTime() < now ? 'red' : 'amber'}>
              {r.status === 'open' ? `Do ${fmtDate(r.due_at)}` : r.status === 'done' ? 'Vybavená' : 'Zamietnutá'}
            </Badge>
          </div>
          {r.note && <p className="text-sm">{r.note}</p>}
          {r.resolution && <p className="rounded bg-gray-100 px-3 py-2 text-sm">{r.resolution}</p>}
          {r.status === 'open' && (
            <DecisionForm action={handleDataRequest} id={r.id} reasonLabel="Ako bola žiadosť vybavená"
              choices={[{ value: 'done', label: 'Vybavená', variant: 'success', needsReason: true }, { value: 'rejected', label: 'Zamietnuť', variant: 'danger', needsReason: true }]} />
          )}
        </article>
      ))}
    </div>
  )
}
