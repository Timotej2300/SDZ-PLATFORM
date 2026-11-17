import { createClient } from '@/lib/supabase/server'
import { requireOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, PageHeader } from '@/components/ui'
import { COMPLAINT_STATUS_LABELS, fmtDate, fmtDateTime } from '@/lib/labels'
import { answerStatement } from '@/actions/oversight'

export const metadata = { title: 'Sťažnosti – vyjadrenia' }

type R = { statement_id: string; complaint_number: string; subject: string; body: string; status: string; requested_at: string; due_at: string; answer: string | null; answered_at: string | null }

export default async function Page() {
  const org = await requireOrgPermission('complaints.respond')
  const supabase = await createClient()
  const { data } = await supabase.rpc('list_org_complaints', { p_org: org.id })
  const rows = (data ?? []) as R[]
  return (
    <div className="space-y-6">
      <PageHeader title="Sťažnosti – žiadosti o vyjadrenie" intro="Tu vidíte iba sťažnosti, k ktorým vás SDZ požiadalo o vyjadrenie. Totožnosť podávateľa sa nezobrazuje." />
      {rows.length === 0 ? <Empty title="Žiadne žiadosti o vyjadrenie" /> : rows.map((r) => (
        <article key={r.statement_id} className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{r.complaint_number} · {r.subject}</p>
            <Badge tone={r.answered_at ? 'green' : 'amber'}>{r.answered_at ? 'Zodpovedané' : `Do ${fmtDate(r.due_at)}`}</Badge>
          </div>
          <p className="text-xs text-ink-600">Stav sťažnosti: {COMPLAINT_STATUS_LABELS[r.status]} · požiadané {fmtDateTime(r.requested_at)}</p>
          <p className="whitespace-pre-line text-sm">{r.body}</p>
          {r.answered_at ? <p className="rounded bg-gray-100 px-3 py-2 text-sm"><b>Vaše vyjadrenie:</b> {r.answer}</p> : (
            <ActionForm action={answerStatement} submit="Odoslať vyjadrenie" confirm="Vyjadrenie sa nedá po odoslaní zmeniť. Odoslať?">
              <input type="hidden" name="id" value={r.statement_id} />
              <textarea name="body" required minLength={10} maxLength={4000} rows={4} aria-label="Vyjadrenie" className="input" />
            </ActionForm>
          )}
        </article>
      ))}
    </div>
  )
}
