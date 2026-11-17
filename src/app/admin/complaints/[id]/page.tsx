import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, requirePermission, requireUser } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { DecisionForm } from '@/components/DecisionForm'
import { Badge, PageHeader, Select, statusTone } from '@/components/ui'
import { COMPLAINT_STATUS_LABELS, COMPLAINT_TARGET_LABELS, fmtDateTime } from '@/lib/labels'
import { addComplaintMessage, requestStatement, setComplaintStatus } from '@/actions/oversight'

export const metadata = { title: 'Sťažnosť' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePermission('complaints.read', `/admin/complaints/${id}`)
  const me = await requireUser()
  const supabase = await createClient()
  const { data: c } = await supabase.from('complaints').select('*').eq('id', id).maybeSingle()
  if (!c) notFound()
  const [{ data: msgs }, { data: hist }, { data: sts }, { data: sub }, { data: orgs }, canManage] = await Promise.all([
    supabase.from('complaint_messages').select('id,author_kind,internal,body,created_at').eq('complaint_id', id).order('created_at'),
    supabase.from('complaint_history').select('id,event,note,created_at').eq('complaint_id', id).order('created_at'),
    supabase.from('complaint_statements').select('id,organization_id,requested_at,due_at,body,answered_at').eq('complaint_id', id),
    supabase.from('profiles').select('first_name,last_name,email').eq('id', c.submitter_id).maybeSingle(),
    supabase.from('organizations').select('id,name').eq('status', 'approved').order('name').limit(1000),
    hasPermission('complaints.manage'),
  ])
  const orgName = new Map(((orgs ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name]))
  const own = c.submitter_id === me.id
  const closed = ['resolved', 'rejected', 'withdrawn'].includes(c.status)
  const stmts = (sts ?? []) as { id: string; organization_id: string; requested_at: string; due_at: string; body: string | null; answered_at: string | null }[]
  const requested = new Set(stmts.map((s) => s.organization_id))
  return (
    <div className="space-y-6">
      <PageHeader title={`${c.complaint_number} · ${c.subject}`}>
        <Badge tone={statusTone(c.status === 'resolved' ? 'approved' : c.status)}>{COMPLAINT_STATUS_LABELS[c.status]}</Badge>
      </PageHeader>
      <section className="card space-y-1">
        <p className="text-sm text-ink-600">Podávateľ: {sub ? `${sub.first_name} ${sub.last_name} (${sub.email})` : '—'} · {COMPLAINT_TARGET_LABELS[c.target_type]}{c.target_org_id ? ` · ${orgName.get(c.target_org_id) ?? 'organizácia'}` : ''} · {fmtDateTime(c.created_at)}</p>
        <p className="whitespace-pre-line">{c.body}</p>
        {c.resolution && <p className="rounded bg-gray-100 px-3 py-2 text-sm"><b>Záver:</b> {c.resolution}</p>}
      </section>
      <section className="card space-y-2">
        <h2 className="font-semibold">Komunikácia</h2>
        {((msgs ?? []) as { id: string; author_kind: string; internal: boolean; body: string; created_at: string }[]).map((m) => (
          <p key={m.id} className={`rounded px-3 py-2 text-sm ${m.internal ? 'bg-amber-100' : m.author_kind === 'staff' ? 'bg-gray-100' : 'bg-green-50'}`}>
            <b>{m.internal ? 'Interná poznámka' : m.author_kind === 'staff' ? 'SDZ' : 'Podávateľ'}:</b> {m.body} <span className="text-xs text-ink-600">({fmtDateTime(m.created_at)})</span>
          </p>
        ))}
        {canManage && !own && !closed && (
          <ActionForm action={addComplaintMessage} submit="Pridať správu" variant="secondary" resetOnSuccess>
            <input type="hidden" name="id" value={id} />
            <textarea name="body" required rows={3} maxLength={4000} aria-label="Správa" className="input" />
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="internal" /> Interná poznámka (podávateľ ju neuvidí)</label>
          </ActionForm>
        )}
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Vyjadrenia organizácií</h2>
        {stmts.length === 0 && <p className="text-sm text-ink-600">Nikto nebol požiadaný o vyjadrenie.</p>}
        {stmts.map((s) => (
          <p key={s.id} className="rounded bg-gray-100 px-3 py-2 text-sm">
            <b>{orgName.get(s.organization_id) ?? 'Organizácia'}</b> (požiadané {fmtDateTime(s.requested_at)}, lehota {fmtDateTime(s.due_at)}):{' '}
            {s.answered_at ? s.body : 'zatiaľ bez odpovede'}
          </p>
        ))}
        {canManage && !own && !closed && (
          <ActionForm action={requestStatement} submit="Vyžiadať vyjadrenie" variant="secondary">
            <input type="hidden" name="id" value={id} />
            <Select label="Organizácia" name="org_id" required placeholder="— vyberte —" options={[...orgName].filter(([k]) => !requested.has(k)).map(([value, label]) => ({ value, label }))} />
          </ActionForm>
        )}
      </section>
      {canManage && !own && !closed && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Zmena stavu</h2>
          <DecisionForm action={setComplaintStatus} id={id} reasonLabel="Dôvod / záver (povinný pri doplnení, vyriešení, zamietnutí)"
            choices={[
              { value: 'in_review', label: 'Začať riešiť', variant: 'secondary' },
              { value: 'needs_info', label: 'Vyžiadať doplnenie', variant: 'secondary', needsReason: true },
              { value: 'resolved', label: 'Vyriešená', variant: 'success', needsReason: true },
              { value: 'rejected', label: 'Zamietnuť', variant: 'danger', needsReason: true },
            ]} />
        </section>
      )}
      {own && <p className="text-sm text-ink-600">Ide o vašu vlastnú sťažnosť – riešiť ju musí iná osoba.</p>}
      <section className="card">
        <h2 className="mb-2 font-semibold">História</h2>
        <ul className="space-y-1 text-sm">
          {((hist ?? []) as { id: string; event: string; note: string | null; created_at: string }[]).map((h) => (
            <li key={h.id}>{fmtDateTime(h.created_at)} · {h.event}{h.note && h.event !== 'statement_requested' ? ` – ${h.note}` : ''}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
