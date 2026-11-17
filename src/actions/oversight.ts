'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dbMessage, type ActionState } from '@/lib/errors'
import { uuidSchema } from '@/lib/validation'
import { localToIso } from '@/lib/events'

const refresh = () => {
  revalidatePath('/account', 'layout')
  revalidatePath('/organization', 'layout')
  revalidatePath('/admin', 'layout')
}
const bad = { error: 'Neplatná požiadavka.' }
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

export async function submitComplaint(_: ActionState, fd: FormData): Promise<ActionState> {
  const type = str(fd, 'target_type')
  const org = str(fd, 'org_id')
  const orgId = org ? uuidSchema.safeParse(org) : null
  if (orgId && !orgId.success) return bad
  const subject = str(fd, 'subject')
  const body = str(fd, 'body')
  if (subject.length < 3) return { error: 'Zadajte predmet (aspoň 3 znaky).' }
  if (body.length < 10) return { error: 'Popíšte problém podrobnejšie (aspoň 10 znakov).' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_complaint', {
    p_target_type: type, p_org: orgId?.data ?? null, p_event: null, p_subject: subject, p_body: body,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Sťažnosť bola odoslaná. O jej riešení vás budeme informovať.' }
}

export async function withdrawComplaint(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return bad
  const supabase = await createClient()
  const { error } = await supabase.rpc('withdraw_complaint', { p_id: id.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Sťažnosť bola stiahnutá.' }
}

export async function setComplaintStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const status = str(fd, 'decision')
  if (!id.success || !['in_review', 'needs_info', 'resolved', 'rejected'].includes(status)) return bad
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_complaint_status', { p_id: id.data, p_status: status, p_note: str(fd, 'reason') || null })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Stav sťažnosti bol zmenený.' }
}

export async function addComplaintMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const body = str(fd, 'body')
  if (!id.success) return bad
  if (!body) return { error: 'Napíšte správu.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('add_complaint_message', { p_id: id.data, p_body: body, p_internal: fd.get('internal') === 'on' })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Správa bola pridaná.' }
}

export async function requestStatement(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const org = uuidSchema.safeParse(fd.get('org_id'))
  if (!id.success || !org.success) return bad
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_statement', { p_id: id.data, p_org: org.data })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Organizácia bola požiadaná o vyjadrenie.' }
}

export async function answerStatement(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const body = str(fd, 'body')
  if (!id.success) return bad
  if (body.length < 10) return { error: 'Vyjadrenie musí mať aspoň 10 znakov.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('answer_statement', { p_id: id.data, p_body: body })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Vyjadrenie bolo odoslané.' }
}

export async function suspendOrganization(_: ActionState, fd: FormData): Promise<ActionState> {
  const org = uuidSchema.safeParse(fd.get('org_id'))
  const reason = str(fd, 'reason')
  if (!org.success) return { error: 'Vyberte organizáciu.' }
  if (reason.length < 10) return { error: 'Dôvod musí mať aspoň 10 znakov.' }
  const startRaw = str(fd, 'starts')
  const endRaw = str(fd, 'ends')
  const starts = startRaw ? localToIso(startRaw) : null
  const ends = endRaw ? localToIso(endRaw) : null
  if ((startRaw && !starts) || (endRaw && !ends)) return { error: 'Neplatný dátum.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('suspend_organization', { p_org: org.data, p_reason: reason, p_starts: starts, p_ends: ends })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Pozastavenie bolo zaznamenané.' }
}

export async function liftSuspension(_: ActionState, fd: FormData): Promise<ActionState> {
  const org = uuidSchema.safeParse(fd.get('org_id'))
  if (!org.success) return bad
  const supabase = await createClient()
  const { error } = await supabase.rpc('lift_suspension', { p_org: org.data, p_note: str(fd, 'reason') || null })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Pozastavenie bolo zrušené.' }
}

export async function requestDataAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const kind = str(fd, 'kind')
  if (!['access', 'rectification', 'erasure', 'restriction', 'objection'].includes(kind)) return bad
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_data_action', { p_kind: kind, p_note: str(fd, 'note') || null })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Žiadosť bola odoslaná. Vybavíme ju do 30 dní.' }
}

export async function handleDataRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const status = str(fd, 'decision')
  if (!id.success || !['done', 'rejected'].includes(status)) return bad
  const supabase = await createClient()
  const { error } = await supabase.rpc('handle_data_request', { p_id: id.data, p_status: status, p_resolution: str(fd, 'reason') })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Žiadosť bola vybavená.' }
}
