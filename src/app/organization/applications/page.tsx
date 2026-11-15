import { createClient } from '@/lib/supabase/server'
import { hasOrgPermission, requireOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { DecisionForm } from '@/components/DecisionForm'
import { AnswersList } from '@/components/FormFields'
import { Badge, Empty, PageHeader, Table, Td, licenseTone, statusTone } from '@/components/ui'
import { APP_STATUS_LABELS, CONSENT_LABELS, fmtDate, fmtDateTime } from '@/lib/labels'
import type { FormField } from '@/lib/events'
import { assignApplication, decideConsent, reviewApplication, unassignApplication } from '@/actions/events'

export const metadata = { title: 'Prihlášky' }

type App = {
  id: string; status: string; message: string | null; answers: Record<string, unknown>; home_org_consent_status: string
  submitted_at: string | null; decision_note: string | null; team_id: string | null; position_id: string | null
  form_version_id: string | null; event_id: string
  events: { id: string; title: string; starts_at: string }
  volunteers: { id: string; registration_number: string; profiles: { first_name: string; last_name: string; birth_year: number | null } | null } | null
}
type Named = { id: string; event_id: string; name: string }
type Shift = { id: string; event_id: string; starts_at: string; ends_at: string; note: string | null }
type Consent = { app_id: string; event_title: string; event_org: string; event_starts: string; volunteer_name: string; consent: string; submitted: string }

const reviewChoices = {
  early: [
    { value: 'start_review', label: 'Začať kontrolu', variant: 'secondary' as const },
    { value: 'approve', label: 'Schváliť', variant: 'success' as const },
    { value: 'request_info', label: 'Vyžiadať doplnenie', variant: 'secondary' as const, needsReason: true },
    { value: 'reject', label: 'Zamietnuť', variant: 'danger' as const, needsReason: true },
  ],
  review: [
    { value: 'approve', label: 'Schváliť', variant: 'success' as const },
    { value: 'request_info', label: 'Vyžiadať doplnenie', variant: 'secondary' as const, needsReason: true },
    { value: 'reject', label: 'Zamietnuť', variant: 'danger' as const, needsReason: true },
  ],
  info: [{ value: 'reject', label: 'Zamietnuť', variant: 'danger' as const, needsReason: true }],
}

export default async function Page() {
  const org = await requireOrgPermission('applications.decide', 'events.consent')
  const [canDecide, canConsent] = await Promise.all([
    hasOrgPermission('applications.decide', org.id),
    hasOrgPermission('events.consent', org.id),
  ])
  const supabase = await createClient()

  let consents: Consent[] = []
  if (canConsent) {
    const { data } = await supabase.rpc('list_consent_requests', { p_org: org.id })
    consents = (data ?? []) as Consent[]
  }

  let apps: App[] = []
  const fieldsByVersion = new Map<string, FormField[]>()
  const licenses = new Map<string, { status: string; expires_on: string }>()
  const teams: Named[] = []; const positions: Named[] = []; const shifts: Shift[] = []
  const assigned = new Map<string, string[]>()
  if (canDecide) {
    const { data } = await supabase
      .from('applications')
      .select('id,status,message,answers,home_org_consent_status,submitted_at,decision_note,team_id,position_id,form_version_id,event_id,events!inner(id,title,starts_at,organization_id),volunteers(id,registration_number,profiles(first_name,last_name,birth_year))')
      .eq('events.organization_id', org.id)
      .neq('status', 'cancelled')
      .order('submitted_at', { ascending: false })
      .limit(200)
    apps = (data ?? []) as unknown as App[]
    const eventIds = [...new Set(apps.map((a) => a.event_id))]
    const versionIds = [...new Set(apps.map((a) => a.form_version_id).filter(Boolean))] as string[]
    const volIds = [...new Set(apps.map((a) => a.volunteers?.id).filter(Boolean))] as string[]
    const appIds = apps.map((a) => a.id)
    if (eventIds.length) {
      const [fv, lic, t, p, s, sa] = await Promise.all([
        versionIds.length ? supabase.from('form_versions').select('id,fields').in('id', versionIds) : Promise.resolve({ data: [] }),
        volIds.length ? supabase.from('volunteer_licenses').select('volunteer_id,status,expires_on').in('volunteer_id', volIds).in('status', ['active', 'expiring']) : Promise.resolve({ data: [] }),
        supabase.from('event_teams').select('id,event_id,name').in('event_id', eventIds),
        supabase.from('event_positions').select('id,event_id,name').in('event_id', eventIds),
        supabase.from('event_shifts').select('id,event_id,starts_at,ends_at,note').in('event_id', eventIds).order('starts_at'),
        appIds.length ? supabase.from('shift_assignments').select('application_id,shift_id').in('application_id', appIds) : Promise.resolve({ data: [] }),
      ])
      for (const v of (fv.data ?? []) as { id: string; fields: FormField[] }[]) fieldsByVersion.set(v.id, v.fields)
      for (const l of (lic.data ?? []) as { volunteer_id: string; status: string; expires_on: string }[]) licenses.set(l.volunteer_id, l)
      teams.push(...((t.data ?? []) as Named[])); positions.push(...((p.data ?? []) as Named[])); shifts.push(...((s.data ?? []) as Shift[]))
      for (const r of (sa.data ?? []) as { application_id: string; shift_id: string }[]) {
        assigned.set(r.application_id, [...(assigned.get(r.application_id) ?? []), r.shift_id])
      }
    }
  }
  const nm = (a: App) => `${a.volunteers?.profiles?.first_name ?? ''} ${a.volunteers?.profiles?.last_name ?? ''}`

  return (
    <div className="space-y-8">
      <PageHeader title="Prihlášky" intro="Dobrovoľník sa môže prihlásiť iba s platnou licenciou. Na cudzie podujatie najprv musí súhlasiť jeho domovská organizácia." />

      {canConsent && (
        <section>
          <h2 className="mb-2 font-semibold">Súhlas s prihláškami našich dobrovoľníkov na cudzie podujatia</h2>
          {consents.length === 0 ? <Empty title="Žiadne žiadosti o súhlas" /> : (
            <div className="space-y-3">
              {consents.map((c) => (
                <div key={c.app_id} className="card">
                  <p className="font-semibold">{c.volunteer_name}</p>
                  <p className="text-sm text-ink-600">{c.event_title} · {c.event_org} · {fmtDateTime(c.event_starts)}</p>
                  <p className="mt-1 text-sm">Súhlas: <Badge tone={c.consent === 'granted' ? 'green' : c.consent === 'denied' ? 'red' : 'amber'}>{CONSENT_LABELS[c.consent]}</Badge></p>
                  {c.consent === 'pending' && (
                    <div className="mt-3">
                      <DecisionForm action={decideConsent} id={c.app_id} choices={[
                        { value: 'grant', label: 'Súhlasiť', variant: 'success' },
                        { value: 'deny', label: 'Nesúhlasiť', variant: 'danger', needsReason: true },
                      ]} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canDecide && (
        <section>
          <h2 className="mb-2 font-semibold">Prihlášky na naše podujatia</h2>
          {apps.length === 0 ? <Empty title="Zatiaľ žiadne prihlášky" /> : (
            <div className="space-y-4">
              {apps.map((a) => {
                const lic = a.volunteers ? licenses.get(a.volunteers.id) : undefined
                const evTeams = teams.filter((t) => t.event_id === a.event_id)
                const evPos = positions.filter((t) => t.event_id === a.event_id)
                const evShifts = shifts.filter((t) => t.event_id === a.event_id)
                const mine = new Set(assigned.get(a.id) ?? [])
                return (
                  <article key={a.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{nm(a)} <span className="font-mono text-xs font-normal">{a.volunteers?.registration_number}</span></h3>
                        <p className="text-sm text-ink-600">{a.events.title} · {fmtDateTime(a.events.starts_at)} · odoslaná {fmtDate(a.submitted_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={statusTone(a.status === 'assigned' ? 'approved' : a.status)}>{APP_STATUS_LABELS[a.status]}</Badge>
                        <Badge tone={licenseTone(lic?.status)}>{lic ? `Licencia do ${fmtDate(lic.expires_on)}` : 'Bez platnej licencie'}</Badge>
                        {a.home_org_consent_status !== 'not_required' && <Badge tone={a.home_org_consent_status === 'granted' ? 'green' : a.home_org_consent_status === 'denied' ? 'red' : 'amber'}>Súhlas: {CONSENT_LABELS[a.home_org_consent_status]}</Badge>}
                      </div>
                    </div>
                    {a.message && <p className="mt-2 text-sm">„{a.message}“</p>}
                    <AnswersList fields={fieldsByVersion.get(a.form_version_id ?? '') ?? []} answers={a.answers ?? {}} />
                    {a.decision_note && <p className="mt-2 text-sm text-ink-600">Poznámka: {a.decision_note}</p>}

                    {['submitted', 'in_review', 'needs_info'].includes(a.status) && (
                      <div className="mt-3">
                        <DecisionForm action={reviewApplication} id={a.id}
                          choices={a.status === 'submitted' ? reviewChoices.early : a.status === 'in_review' ? reviewChoices.review : reviewChoices.info} />
                        {a.home_org_consent_status === 'pending' && <p className="mt-2 text-xs text-ink-600">Pred schválením musí súhlasiť domovská organizácia dobrovoľníka.</p>}
                      </div>
                    )}
                    {['approved', 'assigned'].includes(a.status) && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <h4 className="mb-2 text-sm font-semibold">Zaradenie</h4>
                        <ActionForm action={assignApplication} submit={a.status === 'assigned' ? 'Uložiť zaradenie' : 'Zaradiť'}>
                          <input type="hidden" name="id" value={a.id} />
                          <div className="grid gap-x-4 sm:grid-cols-2">
                            <div className="mb-3">
                              <label className="label" htmlFor={`team-${a.id}`}>Tím</label>
                              <select id={`team-${a.id}`} name="team_id" defaultValue={a.team_id ?? ''} className="input">
                                <option value="">— bez tímu —</option>
                                {evTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </div>
                            <div className="mb-3">
                              <label className="label" htmlFor={`pos-${a.id}`}>Pozícia</label>
                              <select id={`pos-${a.id}`} name="position_id" defaultValue={a.position_id ?? ''} className="input">
                                <option value="">— bez pozície —</option>
                                {evPos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </div>
                          </div>
                          {evShifts.length > 0 && (
                            <fieldset className="mb-2">
                              <legend className="label">Pracovné zmeny</legend>
                              {evShifts.map((s) => (
                                <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
                                  <input type="checkbox" name="shift_ids" value={s.id} defaultChecked={mine.has(s.id)} className="h-5 w-5" />
                                  {fmtDateTime(s.starts_at)} – {fmtDateTime(s.ends_at)}{s.note ? ` (${s.note})` : ''}
                                </label>
                              ))}
                            </fieldset>
                          )}
                        </ActionForm>
                        {a.status === 'assigned' && (
                          <ActionForm action={unassignApplication} submit="Zrušiť zaradenie" variant="secondary" confirm="Zrušiť zaradenie dobrovoľníka?" className="mt-2">
                            <input type="hidden" name="id" value={a.id} />
                          </ActionForm>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
