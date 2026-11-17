import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, PageHeader, Select } from '@/components/ui'
import { DATA_KIND_LABELS, fmtDate } from '@/lib/labels'
import { requestDataAction } from '@/actions/oversight'

export const metadata = { title: 'Ochrana osobných údajov' }

type D = { id: string; kind: string; status: string; created_at: string; due_at: string; resolution: string | null }

export default async function Page() {
  const me = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from('data_requests').select('id,kind,status,created_at,due_at,resolution').eq('user_id', me.id).order('created_at', { ascending: false })
  const rows = (data ?? []) as D[]
  return (
    <div className="space-y-6">
      <PageHeader title="Ochrana osobných údajov" intro="Uplatnite si svoje práva podľa GDPR. SDZ ukladá iba rok narodenia, nie celý dátum. Žiadosť vybavíme do 30 dní." />
      <section className="card">
        <h2 className="font-semibold">Stiahnuť moje údaje</h2>
        <p className="mt-1 text-sm text-ink-600">Okamžitý export vašich údajov vo formáte JSON (profil, členstvá, licencie, prihlášky, dochádzka, certifikáty, sťažnosti, oznámenia).</p>
        <a href="/account/privacy/export" className="btn-secondary mt-3">Stiahnuť export (JSON)</a>
      </section>
      <section className="card">
        <h2 className="font-semibold">Podať žiadosť</h2>
        <p className="mt-1 text-sm text-ink-600">Vymazanie sa posudzuje individuálne: údaje, ktoré SDZ musí uchovať (história licencií, auditné záznamy, odpracované hodiny), sa nemažú, ale obmedzia sa.</p>
        <ActionForm action={requestDataAction} submit="Odoslať žiadosť" resetOnSuccess>
          <Select label="Druh žiadosti" name="kind" required options={Object.entries(DATA_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
          <div className="mb-3"><label htmlFor="note" className="label">Poznámka</label><textarea id="note" name="note" rows={3} maxLength={2000} className="input" /></div>
        </ActionForm>
      </section>
      {rows.length === 0 ? <Empty title="Zatiaľ žiadne žiadosti" /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{DATA_KIND_LABELS[r.kind]}</p>
                <Badge tone={r.status === 'done' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status === 'open' ? 'Otvorená' : r.status === 'done' ? 'Vybavená' : 'Zamietnutá'}</Badge>
              </div>
              <p className="text-xs text-ink-600">Podaná {fmtDate(r.created_at)} · lehota do {fmtDate(r.due_at)}</p>
              {r.resolution && <p className="mt-1 text-sm">{r.resolution}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
