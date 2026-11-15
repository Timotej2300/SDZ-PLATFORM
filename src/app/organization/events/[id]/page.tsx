import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { EventForm, type EventRow } from '@/components/EventForm'
import { Badge, PageHeader } from '@/components/ui'
import { EVENT_STATUS_LABELS } from '@/lib/labels'
import { cancelEvent, deleteEvent, setEventPublished } from '@/actions/events'
import { loadEventFormOptions } from '@/lib/event-options'

export const metadata = { title: 'Podujatie' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const org = await requireOrgPermission('events.manage')
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('*').eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!data) notFound()
  const e = data as EventRow & { slug: string; organization_id: string }
  const [opts, { count: teams }, { count: positions }, { count: shifts }, { count: apps }] = await Promise.all([
    loadEventFormOptions(org.id),
    supabase.from('event_teams').select('id', { count: 'exact', head: true }).eq('event_id', id),
    supabase.from('event_positions').select('id', { count: 'exact', head: true }).eq('event_id', id),
    supabase.from('event_shifts').select('id', { count: 'exact', head: true }).eq('event_id', id),
    supabase.from('applications').select('id', { count: 'exact', head: true }).eq('event_id', id).neq('status', 'cancelled'),
  ])
  // verzia formulára použitá na tomto podujatí musí byť v zozname aj po vydaní novej verzie
  const formOptions = [...opts.formVersions]
  if (e.form_version_id && !formOptions.some((o) => o.value === e.form_version_id)) {
    const { data: fv } = await supabase.from('form_versions').select('version,forms(name)').eq('id', e.form_version_id).maybeSingle()
    const f = fv as unknown as { version: number; forms: { name: string } | null } | null
    formOptions.unshift({ value: e.form_version_id, label: `${f?.forms?.name ?? 'Formulár'} (verzia ${f?.version ?? '?'}, použitá)` })
  }

  return (
    <div className="space-y-6">
      <PageHeader title={e.title}>
        <Badge tone={e.status === 'published' ? 'green' : e.status === 'cancelled' ? 'red' : 'blue'}>{EVENT_STATUS_LABELS[e.status]}</Badge>
      </PageHeader>
      <section className="card text-sm">
        <p>Tímy: <b>{teams ?? 0}</b> · Pozície: <b>{positions ?? 0}</b> · Pracovné zmeny: <b>{shifts ?? 0}</b> · Prihlášky: <b>{apps ?? 0}</b></p>
        <p className="mt-2 flex flex-wrap gap-4">
          <Link className="text-navy-700 underline" href="/organization/teams">Tímy</Link>
          <Link className="text-navy-700 underline" href="/organization/positions">Pozície</Link>
          <Link className="text-navy-700 underline" href="/organization/shifts">Pracovné zmeny</Link>
          <Link className="text-navy-700 underline" href="/organization/applications">Prihlášky</Link>
          {e.status === 'published' && <Link className="text-navy-700 underline" href={`/podujatia/${e.slug}`}>Verejná stránka</Link>}
        </p>
      </section>

      {e.status !== 'cancelled' && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Údaje o podujatí</h2>
          <EventForm event={e} regions={opts.regions} formVersions={formOptions} />
        </section>
      )}

      {e.status !== 'cancelled' && (
        <section className="card space-y-4">
          <h2 className="font-semibold">Zverejnenie a zrušenie</h2>
          {e.status === 'draft' && (
            <ActionForm action={setEventPublished} submit="Zverejniť podujatie" variant="success" confirm="Zverejniť podujatie? Dobrovoľníci sa budú môcť prihlasovať.">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="publish" value="1" />
            </ActionForm>
          )}
          {e.status === 'published' && (
            <ActionForm action={setEventPublished} submit="Vrátiť do rozpracovaných" variant="secondary">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="publish" value="0" />
            </ActionForm>
          )}
          <ActionForm action={cancelEvent} submit="Zrušiť podujatie" variant="danger" confirm="Zrušiť podujatie? Všetky prihlášky sa zrušia.">
            <input type="hidden" name="id" value={e.id} />
            <label htmlFor="reason" className="label">Dôvod zrušenia</label>
            <input id="reason" name="reason" className="input max-w-md" maxLength={1000} />
          </ActionForm>
          {e.status === 'draft' && (
            <ActionForm action={deleteEvent} submit="Zmazať rozpracované podujatie" variant="danger" confirm="Naozaj zmazať podujatie?">
              <input type="hidden" name="id" value={e.id} />
            </ActionForm>
          )}
        </section>
      )}
    </div>
  )
}
