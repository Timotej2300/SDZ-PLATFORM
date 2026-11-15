import { ActionForm } from '@/components/ActionForm'
import { Field, Select } from '@/components/ui'
import { isoToLocalInput } from '@/lib/events'
import { saveEvent } from '@/actions/events'

export type EventRow = {
  id: string; title: string; description: string | null; location: string | null; region_id: string | null
  starts_at: string; ends_at: string; capacity: number | null; min_age: number | null; max_age: number | null
  registration_deadline: string | null; accommodation: boolean; meals: boolean; form_version_id: string | null; status: string
}

export function EventForm({
  event,
  regions,
  formVersions,
}: {
  event?: EventRow
  regions: { id: string; name: string }[]
  formVersions: { value: string; label: string }[]
}) {
  return (
    <ActionForm action={saveEvent} submit={event ? 'Uložiť podujatie' : 'Vytvoriť podujatie'} className="max-w-2xl">
      {event && <input type="hidden" name="id" value={event.id} />}
      <Field label="Názov" name="title" defaultValue={event?.title} required maxLength={200} />
      <div className="mb-3">
        <label htmlFor="description" className="label">Popis</label>
        <textarea id="description" name="description" defaultValue={event?.description ?? ''} maxLength={8000} className="input" />
      </div>
      <Field label="Miesto konania" name="location" defaultValue={event?.location} maxLength={300} />
      <Select label="Kraj" name="region_id" defaultValue={event?.region_id} placeholder="— nevybraný —"
        options={regions.map((r) => ({ value: r.id, label: r.name }))} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Začiatok (slovenský čas)" name="starts_at" type="datetime-local" defaultValue={isoToLocalInput(event?.starts_at)} required />
        <Field label="Koniec (slovenský čas)" name="ends_at" type="datetime-local" defaultValue={isoToLocalInput(event?.ends_at)} required />
      </div>
      <Field label="Termín prihlasovania" name="registration_deadline" type="datetime-local" defaultValue={isoToLocalInput(event?.registration_deadline)} hint="Nepovinné. Po termíne sa už nedá prihlásiť." />
      <div className="grid gap-x-4 sm:grid-cols-3">
        <Field label="Kapacita (počet dobrovoľníkov)" name="capacity" type="number" min={1} defaultValue={event?.capacity} />
        <Field label="Minimálny vek" name="min_age" type="number" min={0} max={120} defaultValue={event?.min_age} hint="Podľa roku narodenia" />
        <Field label="Maximálny vek" name="max_age" type="number" min={0} max={120} defaultValue={event?.max_age} />
      </div>
      <div className="mb-3 flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="accommodation" defaultChecked={event?.accommodation} className="h-5 w-5" /> Zabezpečené ubytovanie</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="meals" defaultChecked={event?.meals} className="h-5 w-5" /> Zabezpečené stravovanie</label>
      </div>
      <Select label="Prihlasovací formulár" name="form_version_id" defaultValue={event?.form_version_id} placeholder="— bez formulára —"
        options={formVersions} />
    </ActionForm>
  )
}
