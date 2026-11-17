'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dbMessage, type ActionState } from '@/lib/errors'
import { reasonSchema, uuidSchema } from '@/lib/validation'

function optionalReason(fd: FormData): string | null {
  const v = String(fd.get('reason') ?? '').trim()
  return v === '' ? null : v
}

async function review(fn: 'review_organization' | 'review_volunteer_registration', idKey: string, path: string, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const decision = String(fd.get('decision') ?? '')
  if (!id.success || !['start_review', 'request_info', 'approve', 'reject'].includes(decision)) return { error: 'Neplatná požiadavka.' }
  const reason = optionalReason(fd)
  if (['request_info', 'reject'].includes(decision) && !reasonSchema.safeParse(reason).success) return { error: 'Uveďte dôvod.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc(fn, { [idKey]: id.data, p_decision: decision, p_note: reason })
  if (error) return { error: dbMessage(error) }
  revalidatePath(path)
  revalidatePath('/admin')
  return { ok: 'Rozhodnutie bolo uložené.' }
}

export async function reviewOrganization(_: ActionState, fd: FormData) {
  return review('review_organization', 'p_org', '/admin/organization-applications', fd)
}
export async function reviewRegistration(_: ActionState, fd: FormData) {
  return review('review_volunteer_registration', 'p_id', '/admin/registrations', fd)
}

export async function setLicenseStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const decision = String(fd.get('decision') ?? '')
  const reason = reasonSchema.safeParse(fd.get('reason'))
  if (!id.success || !['suspend', 'cancel', 'reinstate'].includes(decision)) return { error: 'Neplatná požiadavka.' }
  if (!reason.success) return { error: 'Uveďte dôvod.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_license_status', { p_license: id.data, p_action: decision, p_note: reason.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/licenses')
  return { ok: 'Stav licencie bol zmenený a zapísaný do auditu.' }
}

export async function requestTransferStatement(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const reason = reasonSchema.safeParse(fd.get('reason'))
  if (!id.success || !reason.success) return { error: 'Uveďte, aké stanovisko vyžadujete.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('sdz_request_statement', { p_id: id.data, p_note: reason.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/transfers')
  return { ok: 'Vyžiadanie stanoviska bolo zaznamenané v audite.' }
}

export async function addRegion(_: ActionState, fd: FormData): Promise<ActionState> {
  const code = String(fd.get('code') ?? '').trim().toUpperCase()
  const name = String(fd.get('name') ?? '').trim()
  if (!/^[A-Z]{2,6}$/.test(code) || name.length < 2 || name.length > 100) return { error: 'Zadajte kód (2–6 písmen) a názov.' }
  const supabase = await createClient()
  const { error } = await supabase.from('regions').insert({ code, name })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/regions')
  return { ok: 'Región bol pridaný.' }
}

export async function addDistrict(_: ActionState, fd: FormData): Promise<ActionState> {
  const region = uuidSchema.safeParse(fd.get('region'))
  const name = String(fd.get('name') ?? '').trim()
  if (!region.success || name.length < 2 || name.length > 100) return { error: 'Vyberte región a zadajte názov okresu.' }
  const supabase = await createClient()
  const { error } = await supabase.from('districts').insert({ region_id: region.data, name })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/regions')
  return { ok: 'Okres bol pridaný.' }
}

export async function appointRegionalManager(_: ActionState, fd: FormData): Promise<ActionState> {
  const region = uuidSchema.safeParse(fd.get('region'))
  const email = String(fd.get('email') ?? '').trim()
  if (!region.success || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Vyberte región a zadajte e-mail.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('appoint_regional_manager', { p_email: email, p_region: region.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/regions')
  return { ok: 'Regionálny manažér bol vymenovaný.' }
}

export async function revokeRegionalManager(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná požiadavka.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_regional_manager', { p_user_role_id: id.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/regions')
  return { ok: 'Menovanie bolo zrušené.' }
}

export async function saveAwardType(_: ActionState, fd: FormData): Promise<ActionState> {
  const idRaw = String(fd.get('id') ?? '')
  const id = idRaw ? uuidSchema.safeParse(idRaw) : null
  if (id && !id.success) return { error: 'Neplatná požiadavka.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_award_type', {
    p_id: id?.data ?? null, p_name: String(fd.get('name') ?? '').trim(),
    p_description: String(fd.get('description') ?? '').trim(), p_active: fd.get('active') !== 'off',
  })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/awards')
  return { ok: 'Druh ocenenia bol uložený.' }
}

export async function grantAward(_: ActionState, fd: FormData): Promise<ActionState> {
  const vol = String(fd.get('reg') ?? '').trim()
  const type = uuidSchema.safeParse(fd.get('type'))
  if (!type.success || !vol) return { error: 'Zadajte registračné číslo a vyberte ocenenie.' }
  const supabase = await createClient()
  const { data: v } = await supabase.from('volunteers').select('id').eq('registration_number', vol).maybeSingle()
  if (!v) return { error: 'Dobrovoľník s týmto registračným číslom neexistuje.' }
  const { error } = await supabase.rpc('grant_award', { p_volunteer: v.id, p_type: type.data, p_note: String(fd.get('note') ?? '').trim() || null })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/awards')
  return { ok: 'Ocenenie bolo udelené.' }
}

export async function revokeAward(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná požiadavka.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_award', { p_id: id.data, p_reason: String(fd.get('reason') ?? '').trim() })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/admin/awards')
  return { ok: 'Ocenenie bolo odobraté.' }
}

export async function switchRegion(fd: FormData) {
  const id = uuidSchema.safeParse(fd.get('region'))
  if (!id.success) return
  const { cookies } = await import('next/headers')
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_regions')
  if (!((data ?? []) as { id: string }[]).some((r) => r.id === id.data)) return
  ;(await cookies()).set('sdz_region', id.data, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 90 })
  revalidatePath('/regional', 'layout')
}
