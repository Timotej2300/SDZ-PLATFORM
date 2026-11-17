import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, PageHeader, Select, statusTone } from '@/components/ui'
import { COMPLAINT_STATUS_LABELS, COMPLAINT_TARGET_LABELS, fmtDateTime } from '@/lib/labels'
import { addComplaintMessage, submitComplaint, withdrawComplaint } from '@/actions/oversight'

export const metadata = { title: 'Sťažnosti' }

type C = { id: string; complaint_number: string; subject: string; body: string; status: string; target_type: string; resolution: string | null; created_at: string }
type M = { id: string; complaint_id: string; author_kind: string; body: string; created_at: string }

export default async function Page() {
  const me = await requireUser()
  const supabase = await createClient()
  const [{ data }, { data: msgs }, { data: orgs }] = await Promise.all([
    supabase.from('complaints').select('id,complaint_number,subject,body,status,target_type,resolution,created_at').eq('submitter_id', me.id).order('created_at', { ascending: false }),
    supabase.from('complaint_messages').select('id,complaint_id,author_kind,body,created_at').order('created_at'),
    supabase.from('public_organizations').select('id,name').order('name').limit(500),
  ])
  const rows = (data ?? []) as C[]
  const byC = new Map<string, M[]>()
  for (const m of (msgs ?? []) as M[]) byC.set(m.complaint_id, [...(byC.get(m.complaint_id) ?? []), m])
  const orgOpts = ((orgs ?? []) as { id: string; name: string }[]).map((o) => ({ value: o.id, label: o.name }))
  return (
    <div className="space-y-6">
      <PageHeader title="Sťažnosti" intro="Sťažnosť sa dostane k centrálnemu tímu SDZ. Organizácia, na ktorú sa sťažujete, nedostane vašu totožnosť; môže byť požiadaná iba o vyjadrenie k obsahu." />
      <section className="card">
        <h2 className="font-semibold">Podať sťažnosť</h2>
        <ActionForm action={submitComplaint} submit="Odoslať sťažnosť" resetOnSuccess>
          <Select label="Týka sa" name="target_type" required options={Object.entries(COMPLAINT_TARGET_LABELS).filter(([k]) => k !== 'event').map(([value, label]) => ({ value, label }))} />
          <Select label="Organizácia (ak sa týka organizácie alebo jej podujatia)" name="org_id" placeholder="— žiadna —" options={orgOpts} />
          <div className="mb-3"><label htmlFor="subject" className="label">Predmet *</label><input id="subject" name="subject" required minLength={3} maxLength={200} className="input" /></div>
          <div className="mb-3"><label htmlFor="body" className="label">Popis problému *</label><textarea id="body" name="body" required minLength={10} maxLength={4000} rows={5} className="input" /></div>
        </ActionForm>
      </section>
      {rows.length === 0 ? <Empty title="Zatiaľ ste nepodali žiadnu sťažnosť" /> : rows.map((c) => (
        <article key={c.id} className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{c.complaint_number} · {c.subject}</p>
            <Badge tone={statusTone(c.status === 'resolved' ? 'approved' : c.status)}>{COMPLAINT_STATUS_LABELS[c.status]}</Badge>
          </div>
          <p className="text-xs text-ink-600">{COMPLAINT_TARGET_LABELS[c.target_type]} · {fmtDateTime(c.created_at)}</p>
          <p className="whitespace-pre-line text-sm">{c.body}</p>
          {(byC.get(c.id) ?? []).map((m) => (
            <p key={m.id} className={`rounded px-3 py-2 text-sm ${m.author_kind === 'staff' ? 'bg-gray-100' : 'bg-green-50'}`}>
              <b>{m.author_kind === 'staff' ? 'SDZ' : 'Vy'}:</b> {m.body} <span className="text-xs text-ink-600">({fmtDateTime(m.created_at)})</span>
            </p>
          ))}
          {c.resolution && <p className="rounded bg-gray-100 px-3 py-2 text-sm"><b>Záver:</b> {c.resolution}</p>}
          {['new', 'in_review', 'needs_info'].includes(c.status) && (
            <div className="grid gap-3 md:grid-cols-2">
              <ActionForm action={addComplaintMessage} submit="Pridať správu" variant="secondary" resetOnSuccess>
                <input type="hidden" name="id" value={c.id} />
                <textarea name="body" required rows={2} maxLength={4000} placeholder="Doplnenie alebo odpoveď" aria-label="Správa" className="input" />
              </ActionForm>
              <ActionForm action={withdrawComplaint} submit="Stiahnuť sťažnosť" variant="danger" confirm="Naozaj stiahnuť sťažnosť?"><input type="hidden" name="id" value={c.id} /></ActionForm>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
