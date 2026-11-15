'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/auth'
import { dbMessage, type ActionState } from '@/lib/errors'
import { firstError, reasonSchema, slugify, uuidSchema } from '@/lib/validation'
import { collectAnswers, eventSchema, localToIso, parseFormFields, teamSchema, type FormField } from '@/lib/events'

const refresh = () => {
  revalidatePath('/organization', 'layout')
  revalidatePath('/podujatia', 'layout')
  revalidatePath('/account', 'layout')
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : Number(s)
}
const text = (v: FormDataEntryValue | null) => String(v ?? '')

/* ========== PODUJATIA ========== */
export async function saveEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const idRaw = text(fd.get('id'))
  const id = idRaw ? uuidSchema.safeParse(idRaw) : null
  if (id && !id.success) return { error: 'Neplatné podujatie.' }
  const parsed = eventSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { error: firstError(parsed.error) }
  const d = parsed.data
  const starts = localToIso(d.starts_at)
  const ends = localToIso(d.ends_at)
  if (!starts || !ends) return { error: 'Zadajte platný začiatok a koniec.' }
  if (new Date(ends) <= new Date(starts)) return { error: 'Koniec musí byť po začiatku.' }
  const deadline = d.registration_deadline ? localToIso(d.registration_deadline) : null
  if (d.registration_deadline && !deadline) return { error: 'Neplatný termín prihlasovania.' }
  if (d.min_age !== null && d.max_age !== null && d.min_age > d.max_age) return { error: 'Minimálny vek je vyšší ako maximálny.' }
  const { org } = await getCurrentOrg()
  if (!org) return { error: 'Nepôsobíte v žiadnej organizácii.' }

  const supabase = await createClient()
  const args = {
    p_org: org.id,
    p_title: d.title,
    p_description: d.description,
    p_location: d.location,
    p_region: d.region_id,
    p_starts: starts,
    p_ends: ends,
    p_capacity: d.capacity,
    p_min_age: d.min_age,
    p_max_age: d.max_age,
    p_deadline: deadline,
    p_accommodation: fd.get('accommodation') === 'on',
    p_meals: fd.get('meals') === 'on',
    p_form_version: d.form_version_id,
  }
  if (id?.success) {
    const { error } = await supabase.rpc('save_event', { ...args, p_id: id.data, p_slug: null })
    if (error) return { error: dbMessage(error) }
    refresh()
    return { ok: 'Podujatie bolo uložené.' }
  }
  const base = slugify(d.title)
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`
    const { data, error } = await supabase.rpc('save_event', { ...args, p_id: null, p_slug: slug })
    if (!error) {
      refresh()
      redirect(`/organization/events/${data}`)
    }
    if (!/duplicate|DUPLICATE/.test(String(error.message))) return { error: dbMessage(error) }
  }
  return { error: 'Nepodarilo sa vytvoriť jedinečnú adresu podujatia. Upravte názov.' }
}

export async function setEventPublished(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatné podujatie.' }
  const publish = fd.get('publish') === '1'
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_event_published', { p_id: id.data, p_publish: publish })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: publish ? 'Podujatie je zverejnené.' : 'Podujatie je znova rozpracované.' }
}

export async function cancelEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const reason = reasonSchema.safeParse(fd.get('reason'))
  if (!id.success) return { error: 'Neplatné podujatie.' }
  if (!reason.success) return { error: 'Uveďte dôvod zrušenia.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_event', { p_id: id.data, p_reason: reason.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Podujatie bolo zrušené a prihlášky boli zrušené.' }
}

export async function deleteEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatné podujatie.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_event', { p_id: id.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  redirect('/organization/events')
}

/* ========== TÍMY, POZÍCIE, ZMENY ========== */
export async function saveTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  const event = uuidSchema.safeParse(fd.get('event_id'))
  const parsed = teamSchema.safeParse(Object.fromEntries(fd))
  if (!event.success) return { error: 'Vyberte podujatie.' }
  if (!parsed.success) return { error: firstError(parsed.error) }
  const leader = text(fd.get('leader_profile_id'))
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_team', {
    p_id: null, p_event: event.data, p_name: parsed.data.name, p_description: parsed.data.description,
    p_capacity: parsed.data.capacity, p_leader: leader ? leader : null,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Tím bol vytvorený.' }
}

export async function savePosition(_: ActionState, fd: FormData): Promise<ActionState> {
  const event = uuidSchema.safeParse(fd.get('event_id'))
  const parsed = teamSchema.safeParse(Object.fromEntries(fd))
  if (!event.success) return { error: 'Vyberte podujatie.' }
  if (!parsed.success) return { error: firstError(parsed.error) }
  const team = text(fd.get('team_id'))
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_position', {
    p_id: null, p_event: event.data, p_team: team ? team : null, p_name: parsed.data.name,
    p_description: parsed.data.description, p_capacity: parsed.data.capacity,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Pozícia bola vytvorená.' }
}

export async function saveShift(_: ActionState, fd: FormData): Promise<ActionState> {
  const event = uuidSchema.safeParse(fd.get('event_id'))
  if (!event.success) return { error: 'Vyberte podujatie.' }
  const starts = localToIso(fd.get('starts_at'))
  const ends = localToIso(fd.get('ends_at'))
  if (!starts || !ends) return { error: 'Zadajte platný začiatok a koniec zmeny.' }
  const team = text(fd.get('team_id'))
  const position = text(fd.get('position_id'))
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_shift', {
    p_id: null, p_event: event.data, p_team: team ? team : null, p_position: position ? position : null,
    p_starts: starts, p_ends: ends, p_capacity: num(fd.get('capacity')), p_note: text(fd.get('note')),
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Pracovná zmena bola vytvorená.' }
}

export async function deleteEventItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const kind = text(fd.get('kind'))
  if (!id.success || !['team', 'position', 'shift'].includes(kind)) return { error: 'Neplatná požiadavka.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_event_item', { p_kind: kind, p_id: id.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Položka bola zmazaná.' }
}

/* ========== FORMULÁRE ========== */
export async function saveForm(_: ActionState, fd: FormData): Promise<ActionState> {
  const idRaw = text(fd.get('id'))
  const id = idRaw ? uuidSchema.safeParse(idRaw) : null
  if (id && !id.success) return { error: 'Neplatný formulár.' }
  const name = text(fd.get('name')).trim()
  if (name.length < 2 || name.length > 160) return { error: 'Názov formulára musí mať 2 až 160 znakov.' }
  const parsed = parseFormFields(text(fd.get('fields')))
  if ('error' in parsed) return { error: parsed.error }
  const { org } = await getCurrentOrg()
  if (!org) return { error: 'Nepôsobíte v žiadnej organizácii.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_form', {
    p_id: id?.success ? id.data : null, p_org: org.id, p_name: name,
    p_description: text(fd.get('description')), p_fields: parsed.fields,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: id ? 'Uložená nová verzia formulára. Podujatia s pôvodnou verziou ostávajú bez zmeny.' : 'Formulár bol vytvorený.' }
}

export async function archiveForm(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatný formulár.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_form', { p_id: id.data, p_archived: fd.get('archive') === '1' })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Formulár bol upravený.' }
}

/* ========== PRIHLÁŠKY (organizátor) ========== */
export async function reviewApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const decision = text(fd.get('decision'))
  if (!id.success || !['start_review', 'request_info', 'approve', 'reject'].includes(decision)) return { error: 'Neplatná požiadavka.' }
  const reason = text(fd.get('reason')).trim()
  if (['request_info', 'reject'].includes(decision) && !reasonSchema.safeParse(reason).success) return { error: 'Uveďte dôvod.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('review_application', { p_app: id.data, p_decision: decision, p_note: reason || null })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Rozhodnutie bolo uložené.' }
}

export async function decideConsent(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const decision = text(fd.get('decision'))
  if (!id.success || !['grant', 'deny'].includes(decision)) return { error: 'Neplatná požiadavka.' }
  const reason = text(fd.get('reason')).trim()
  if (decision === 'deny' && !reasonSchema.safeParse(reason).success) return { error: 'Uveďte dôvod.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('decide_home_consent', { p_app: id.data, p_decision: decision, p_note: reason || null })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Rozhodnutie bolo uložené.' }
}

export async function assignApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná prihláška.' }
  const team = text(fd.get('team_id'))
  const position = text(fd.get('position_id'))
  const shifts = fd.getAll('shift_ids').map(String).filter((s) => uuidSchema.safeParse(s).success)
  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_application', {
    p_app: id.data, p_team: team ? team : null, p_position: position ? position : null, p_shifts: shifts,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Dobrovoľník bol zaradený.' }
}

export async function unassignApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná prihláška.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('unassign_application', { p_app: id.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Zaradenie bolo zrušené.' }
}

/* ========== PRIHLÁŠKY (dobrovoľník) ========== */
async function formFieldsForEvent(eventId: string): Promise<FormField[]> {
  const supabase = await createClient()
  const { data: ev } = await supabase.from('events').select('form_version_id').eq('id', eventId).maybeSingle()
  if (!ev?.form_version_id) return []
  const { data: fv } = await supabase.from('form_versions').select('fields').eq('id', ev.form_version_id).maybeSingle()
  return (fv?.fields as FormField[] | undefined) ?? []
}

export async function applyToEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const event = uuidSchema.safeParse(fd.get('event_id'))
  if (!event.success) return { error: 'Neplatné podujatie.' }
  const fields = await formFieldsForEvent(event.data)
  const supabase = await createClient()
  const { error } = await supabase.rpc('apply_to_event', {
    p_event: event.data, p_answers: collectAnswers(fields, fd), p_message: text(fd.get('message')),
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  redirect('/account/applications')
}

export async function resubmitApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná prihláška.' }
  const supabase = await createClient()
  const { data: app } = await supabase.from('applications').select('form_version_id').eq('id', id.data).maybeSingle()
  let fields: FormField[] = []
  if (app?.form_version_id) {
    const { data: fv } = await supabase.from('form_versions').select('fields').eq('id', app.form_version_id).maybeSingle()
    fields = (fv?.fields as FormField[] | undefined) ?? []
  }
  const { error } = await supabase.rpc('resubmit_application', {
    p_app: id.data, p_answers: collectAnswers(fields, fd), p_message: text(fd.get('message')),
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Prihláška bola doplnená a odoslaná na kontrolu.' }
}

export async function cancelApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná prihláška.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_application', { p_app: id.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Prihláška bola zrušená.' }
}
