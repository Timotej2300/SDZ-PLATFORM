'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dbMessage, type ActionState } from '@/lib/errors'
import { reasonSchema, uuidSchema } from '@/lib/validation'
import { localToIso } from '@/lib/events'

const refresh = () => {
  revalidatePath('/organization', 'layout')
  revalidatePath('/account', 'layout')
}

export async function recordAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  const shift = uuidSchema.safeParse(fd.get('shift_id'))
  const vol = uuidSchema.safeParse(fd.get('volunteer_id'))
  if (!shift.success || !vol.success) return { error: 'Neplatná požiadavka.' }
  const checkIn = localToIso(fd.get('in'))
  if (!checkIn) return { error: 'Zadajte čas príchodu.' }
  const outRaw = String(fd.get('out') ?? '').trim()
  const checkOut = outRaw ? localToIso(outRaw) : null
  if (outRaw && !checkOut) return { error: 'Neplatný čas odchodu.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('record_attendance', {
    p_shift: shift.data, p_volunteer: vol.data, p_in: checkIn, p_out: checkOut,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Dochádzka bola zapísaná.' }
}

export async function recordCheckout(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const out = localToIso(fd.get('out'))
  if (!id.success) return { error: 'Neplatná požiadavka.' }
  if (!out) return { error: 'Zadajte čas odchodu.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('record_checkout', { p_id: id.data, p_out: out })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Odchod bol zapísaný.' }
}

export async function correctAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const checkIn = localToIso(fd.get('in'))
  const outRaw = String(fd.get('out') ?? '').trim()
  const checkOut = outRaw ? localToIso(outRaw) : null
  const reason = String(fd.get('reason') ?? '').trim()
  if (!id.success) return { error: 'Neplatná požiadavka.' }
  if (!checkIn || (outRaw && !checkOut)) return { error: 'Zadajte platné časy.' }
  if (reason.length < 5) return { error: 'Uveďte dôvod opravy (aspoň 5 znakov).' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('correct_attendance', {
    p_id: id.data, p_in: checkIn, p_out: checkOut, p_reason: reason,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Oprava bola uložená a zapísaná do histórie.' }
}

export async function issueCertificate(_: ActionState, fd: FormData): Promise<ActionState> {
  const event = uuidSchema.safeParse(fd.get('event_id'))
  const vol = uuidSchema.safeParse(fd.get('volunteer_id'))
  if (!event.success || !vol.success) return { error: 'Neplatná požiadavka.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('issue_certificate', { p_event: event.data, p_volunteer: vol.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Certifikát bol vystavený.' }
}

export async function revokeCertificate(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const reason = reasonSchema.safeParse(fd.get('reason'))
  if (!id.success) return { error: 'Neplatná požiadavka.' }
  if (!reason.success) return { error: 'Uveďte dôvod.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_certificate', { p_id: id.data, p_reason: reason.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Certifikát bol zrušený.' }
}
