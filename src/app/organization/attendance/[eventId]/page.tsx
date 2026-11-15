import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasOrgPermission, requireOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, Field, PageHeader } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'
import { isoToLocalInput } from '@/lib/events'
import { correctAttendance, issueCertificate, recordAttendance, recordCheckout, revokeCertificate } from '@/actions/attendance'

export const metadata = { title: 'Dochádzka podujatia' }

type Shift = { id: string; starts_at: string; ends_at: string; note: string | null }
type Asg = { shift_id: string; volunteer_id: string; volunteers: { registration_number: string; profiles: { first_name: string; last_name: string } | null } | null }
type Rec = { id: string; shift_id: string; volunteer_id: string; checked_in_at: string; checked_out_at: string | null }
type Corr = { attendance_id: string; corrected_at: string; reason: string }
type Hours = { volunteer_id: string; hours: number }
type Cert = { id: string; volunteer_id: string; certificate_number: string; hours: number; revoked_at: string | null }

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const org = await requireOrgPermission('attendance.write', 'certificates.issue')
  const [canWrite, canCert] = await Promise.all([hasOrgPermission('attendance.write', org.id), hasOrgPermission('certificates.issue', org.id)])
  const supabase = await createClient()
  const { data: ev } = await supabase.from('events').select('id,title,starts_at,ends_at,status').eq('id', eventId).eq('organization_id', org.id).maybeSingle()
  if (!ev) notFound()
  const [sh, asg, rec, hrs, cert] = await Promise.all([
    supabase.from('event_shifts').select('id,starts_at,ends_at,note').eq('event_id', eventId).order('starts_at'),
    supabase.from('shift_assignments').select('shift_id,volunteer_id,volunteers(registration_number,profiles(first_name,last_name))').eq('event_id', eventId),
    supabase.from('attendance_records').select('id,shift_id,volunteer_id,checked_in_at,checked_out_at').eq('event_id', eventId),
    supabase.from('volunteer_hours').select('volunteer_id,hours').eq('event_id', eventId),
    supabase.from('volunteer_certificates').select('id,volunteer_id,certificate_number,hours,revoked_at').eq('event_id', eventId),
  ])
  const shifts = (sh.data ?? []) as Shift[]
  const assignments = (asg.data ?? []) as unknown as Asg[]
  const records = (rec.data ?? []) as Rec[]
  const recIds = records.map((r) => r.id)
  const { data: cr } = recIds.length ? await supabase.from('attendance_corrections').select('attendance_id,corrected_at,reason').in('attendance_id', recIds).order('corrected_at') : { data: [] }
  const corrections = (cr ?? []) as Corr[]
  const hours = new Map<string, number>()
  for (const h of (hrs.data ?? []) as Hours[]) hours.set(h.volunteer_id, (hours.get(h.volunteer_id) ?? 0) + Number(h.hours))
  const certs = new Map(((cert.data ?? []) as Cert[]).map((c) => [c.volunteer_id, c]))
  const ended = new Date(ev.ends_at).getTime() < Date.now()
  const people = new Map<string, Asg['volunteers']>()
  for (const a of assignments) people.set(a.volunteer_id, a.volunteers)
  const nm = (v: Asg['volunteers']) => `${v?.profiles?.first_name ?? ''} ${v?.profiles?.last_name ?? ''}`

  return (
    <div className="space-y-8">
      <PageHeader title={ev.title} intro={`${fmtDateTime(ev.starts_at)} – ${fmtDateTime(ev.ends_at)}. Časy zadávajte v slovenskom čase.`} />

      {shifts.length === 0 ? <Empty title="Podujatie nemá pracovné zmeny" hint="Dochádzka sa zapisuje k pracovnej zmene." href="/organization/shifts" cta="Pracovné zmeny" /> : shifts.map((s) => {
        const list = assignments.filter((a) => a.shift_id === s.id)
        return (
          <section key={s.id} className="card">
            <h2 className="font-semibold">{fmtDateTime(s.starts_at)} – {fmtDateTime(s.ends_at)}{s.note ? <span className="font-normal text-ink-600"> · {s.note}</span> : null}</h2>
            {list.length === 0 ? <p className="mt-2 text-sm text-ink-600">Na zmenu nie je zaradený nikto.</p> : (
              <ul className="mt-3 divide-y divide-gray-200">
                {list.map((a) => {
                  const r = records.find((x) => x.shift_id === s.id && x.volunteer_id === a.volunteer_id)
                  const rc = r ? corrections.filter((c) => c.attendance_id === r.id) : []
                  return (
                    <li key={a.volunteer_id} className="py-3">
                      <p className="font-medium">{nm(a.volunteers)} <span className="font-mono text-xs font-normal">{a.volunteers?.registration_number}</span></p>
                      {!r && canWrite && (
                        <ActionForm action={recordAttendance} submit="Zapísať dochádzku" resetOnSuccess>
                          <input type="hidden" name="shift_id" value={s.id} />
                          <input type="hidden" name="volunteer_id" value={a.volunteer_id} />
                          <div className="grid gap-x-4 sm:grid-cols-2">
                            <Field label="Príchod" name="in" type="datetime-local" defaultValue={isoToLocalInput(s.starts_at)} required />
                            <Field label="Odchod (nepovinné)" name="out" type="datetime-local" />
                          </div>
                        </ActionForm>
                      )}
                      {!r && !canWrite && <p className="text-sm text-ink-600">Bez záznamu</p>}
                      {r && (
                        <div className="mt-1 text-sm">
                          <p>
                            Príchod {fmtDateTime(r.checked_in_at)} · {r.checked_out_at ? `odchod ${fmtDateTime(r.checked_out_at)}` : <Badge tone="amber">Odchod nezapísaný</Badge>}
                          </p>
                          {canWrite && !r.checked_out_at && (
                            <ActionForm action={recordCheckout} submit="Zapísať odchod" className="mt-2">
                              <input type="hidden" name="id" value={r.id} />
                              <Field label="Odchod" name="out" type="datetime-local" required />
                            </ActionForm>
                          )}
                          {canWrite && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-navy-700 underline">Opraviť záznam</summary>
                              <ActionForm action={correctAttendance} submit="Uložiť opravu" className="mt-2">
                                <input type="hidden" name="id" value={r.id} />
                                <div className="grid gap-x-4 sm:grid-cols-2">
                                  <Field label="Príchod" name="in" type="datetime-local" defaultValue={isoToLocalInput(r.checked_in_at)} required />
                                  <Field label="Odchod" name="out" type="datetime-local" defaultValue={isoToLocalInput(r.checked_out_at)} />
                                </div>
                                <Field label="Dôvod opravy (povinný)" name="reason" required maxLength={500} />
                              </ActionForm>
                            </details>
                          )}
                          {rc.length > 0 && (
                            <ul className="mt-2 list-disc pl-5 text-xs text-ink-600">
                              {rc.map((c, i) => <li key={i}>Opravené {fmtDateTime(c.corrected_at)}: {c.reason}</li>)}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      {canCert && (
        <section className="card">
          <h2 className="mb-1 font-semibold">Certifikáty</h2>
          <p className="mb-3 text-sm text-ink-600">Certifikát sa dá vystaviť po skončení podujatia dobrovoľníkovi, ktorý má všetky odchody zapísané.</p>
          {people.size === 0 ? <p className="text-sm text-ink-600">Nikto nie je zaradený.</p> : (
            <ul className="divide-y divide-gray-200">
              {[...people.entries()].map(([vid, v]) => {
                const c = certs.get(vid)
                const h = hours.get(vid) ?? 0
                return (
                  <li key={vid} className="py-3">
                    <p className="font-medium">{nm(v)} <span className="text-sm font-normal text-ink-600">· {h.toFixed(2)} h</span></p>
                    {c ? (
                      <div className="mt-1 text-sm">
                        <span className="font-mono">{c.certificate_number}</span>{' '}
                        {c.revoked_at ? <Badge tone="red">Zrušený</Badge> : <Badge tone="green">Platný</Badge>}
                        {!c.revoked_at && (
                          <ActionForm action={revokeCertificate} submit="Zrušiť certifikát" variant="secondary" confirm="Zrušiť certifikát?" className="mt-2">
                            <input type="hidden" name="id" value={c.id} />
                            <Field label="Dôvod zrušenia" name="reason" required maxLength={500} />
                          </ActionForm>
                        )}
                      </div>
                    ) : ended && h > 0 ? (
                      <ActionForm action={issueCertificate} submit="Vystaviť certifikát" className="mt-1">
                        <input type="hidden" name="event_id" value={ev.id} />
                        <input type="hidden" name="volunteer_id" value={vid} />
                      </ActionForm>
                    ) : (
                      <p className="text-sm text-ink-600">{ended ? 'Bez odpracovaných hodín' : 'Podujatie ešte neskončilo'}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
