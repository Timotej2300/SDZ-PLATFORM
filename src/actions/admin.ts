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
