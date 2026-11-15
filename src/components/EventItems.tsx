import { createClient } from '@/lib/supabase/server'
import { requireOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Empty, Field, PageHeader, Select, Table, Td } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'
import { deleteEventItem, savePosition, saveShift, saveTeam } from '@/actions/events'

type Kind = 'team' | 'position' | 'shift'
type Ev = { id: string; title: string; starts_at: string }
type Item = { id: string; event_id: string; name?: string; description?: string | null; capacity: number | null; team_id?: string | null; position_id?: string | null; starts_at?: string; ends_at?: string; note?: string | null }

const TITLES: Record<Kind, [string, string]> = {
  team: ['Pracovné tímy', 'Tímy rozdeľujú dobrovoľníkov na podujatí do skupín.'],
  position: ['Pozície', 'Pozícia je konkrétna úloha dobrovoľníka (napr. informátor, zdravotník).'],
  shift: ['Pracovné zmeny', 'Zmena je časový úsek podujatia. Dochádzka sa zapisuje k pracovnej zmene.'],
}
const TABLE = { team: 'event_teams', position: 'event_positions', shift: 'event_shifts' } as const

export async function EventItems({ kind }: { kind: Kind }) {
  const org = await requireOrgPermission('events.manage')
  const supabase = await createClient()
  const { data: evs } = await supabase.from('events').select('id,title,starts_at').eq('organization_id', org.id)
    .neq('status', 'cancelled').order('starts_at', { ascending: false }).limit(100)
  const events = (evs ?? []) as Ev[]
  const ids = events.map((e) => e.id)
  const [items, teams, positions] = ids.length
    ? await Promise.all([
        supabase.from(TABLE[kind]).select('*').in('event_id', ids).order(kind === 'shift' ? 'starts_at' : 'created_at'),
        supabase.from('event_teams').select('id,event_id,name').in('event_id', ids),
        supabase.from('event_positions').select('id,event_id,name').in('event_id', ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const rows = (items.data ?? []) as Item[]
  const teamName = new Map(((teams.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]))
  const posName = new Map(((positions.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]))
  const evName = new Map(events.map((e) => [e.id, e.title]))
  const evOpts = events.map((e) => ({ value: e.id, label: `${e.title} (${fmtDateTime(e.starts_at)})` }))
  const action = kind === 'team' ? saveTeam : kind === 'position' ? savePosition : saveShift

  return (
    <div className="space-y-8">
      <PageHeader title={TITLES[kind][0]} intro={TITLES[kind][1]} />
      {events.length === 0 ? <Empty title="Najprv vytvorte podujatie" href="/organization/events" cta="Podujatia" /> : (
        <>
          {rows.length === 0 ? <Empty title="Zatiaľ nič nie je vytvorené" /> : (
            <Table head={kind === 'shift' ? ['Podujatie', 'Čas', 'Tím / pozícia', 'Kapacita', ''] : ['Podujatie', 'Názov', kind === 'position' ? 'Tím' : 'Popis', 'Kapacita', '']}>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>{evName.get(r.event_id)}</Td>
                  {kind === 'shift' ? (
                    <>
                      <Td>{fmtDateTime(r.starts_at)} – {fmtDateTime(r.ends_at)}{r.note ? <span className="block text-xs text-ink-600">{r.note}</span> : null}</Td>
                      <Td>{[r.team_id && teamName.get(r.team_id), r.position_id && posName.get(r.position_id)].filter(Boolean).join(' / ') || '—'}</Td>
                    </>
                  ) : (
                    <>
                      <Td className="font-semibold">{r.name}</Td>
                      <Td>{kind === 'position' ? (r.team_id ? teamName.get(r.team_id) : '—') : r.description || '—'}</Td>
                    </>
                  )}
                  <Td>{r.capacity ?? '—'}</Td>
                  <Td>
                    <ActionForm action={deleteEventItem} submit="Zmazať" variant="secondary" confirm="Zmazať položku?">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="kind" value={kind} />
                    </ActionForm>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          <section className="card">
            <h2 className="mb-3 font-semibold">{kind === 'team' ? 'Nový tím' : kind === 'position' ? 'Nová pozícia' : 'Nová pracovná zmena'}</h2>
            <ActionForm action={action} submit="Vytvoriť" resetOnSuccess className="max-w-xl">
              <Select label="Podujatie" name="event_id" required placeholder="Vyberte podujatie" options={evOpts} />
              {kind !== 'shift' && <Field label="Názov" name="name" required maxLength={120} />}
              {kind !== 'shift' && (
                <div className="mb-3">
                  <label htmlFor="description" className="label">Popis</label>
                  <textarea id="description" name="description" maxLength={1000} className="input" />
                </div>
              )}
              {kind === 'position' && (
                <Select label="Tím (nepovinné, musí patriť k rovnakému podujatiu)" name="team_id" placeholder="— bez tímu —"
                  options={((teams.data ?? []) as { id: string; name: string; event_id: string }[]).map((t) => ({ value: t.id, label: `${t.name} – ${evName.get(t.event_id)}` }))} />
              )}
              {kind === 'shift' && (
                <>
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Field label="Začiatok (slovenský čas)" name="starts_at" type="datetime-local" required />
                    <Field label="Koniec (slovenský čas)" name="ends_at" type="datetime-local" required />
                  </div>
                  <Select label="Tím (nepovinné)" name="team_id" placeholder="— bez tímu —"
                    options={((teams.data ?? []) as { id: string; name: string; event_id: string }[]).map((t) => ({ value: t.id, label: `${t.name} – ${evName.get(t.event_id)}` }))} />
                  <Select label="Pozícia (nepovinné)" name="position_id" placeholder="— bez pozície —"
                    options={((positions.data ?? []) as { id: string; name: string; event_id: string }[]).map((t) => ({ value: t.id, label: `${t.name} – ${evName.get(t.event_id)}` }))} />
                  <Field label="Poznámka" name="note" maxLength={500} />
                </>
              )}
              <Field label="Kapacita (nepovinné)" name="capacity" type="number" min={1} />
            </ActionForm>
          </section>
        </>
      )}
    </div>
  )
}
