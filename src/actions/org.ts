'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getContext, getUser, ORG_COOKIE } from '@/lib/auth'
import { dbMessage, type ActionState } from '@/lib/errors'
import { emailSchema, firstError, orgProfileSchema, reasonSchema, uuidSchema } from '@/lib/validation'
import { escapeHtml, newToken, sendEmail, sha256, siteUrl } from '@/lib/server-utils'

export async function switchOrg(fd: FormData) {
  const id = uuidSchema.safeParse(fd.get('org'))
  if (!id.success) return
  const ctx = await getContext()
  if (!ctx.orgs.some((o) => o.id === id.data)) return
  const store = await cookies()
  store.set(ORG_COOKIE, id.data, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 90 })
  revalidatePath('/organization', 'layout')
}

export async function saveOrgProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná organizácia.' }
  const parsed = orgProfileSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { error: firstError(parsed.error) }
  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: d.name, type: d.type, description: d.description ?? null, address: d.address ?? null,
      ico: d.ico ?? null, region_id: d.region_id, district_id: d.district_id, website: d.website ?? null,
      contact_email: d.contact_email, contact_phone: d.contact_phone ?? null,
    })
    .eq('id', id.data)
    .select('id')
  if (error) return { error: dbMessage(error) }
  if (!data || data.length === 0) return { error: 'Organizáciu nie je možné upraviť v aktuálnom stave.' }
  revalidatePath('/organization', 'layout')
  return { ok: 'Profil organizácie bol uložený.' }
}

export async function submitOrg(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná organizácia.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_organization', { p_org: id.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/organization', 'layout')
  return { ok: 'Žiadosť bola odoslaná SDZ na kontrolu.' }
}

const DOC_KINDS = ['registration', 'statute', 'identity', 'other']
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export async function uploadOrgDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser()
  const orgId = uuidSchema.safeParse(fd.get('id'))
  const kind = String(fd.get('kind') ?? '')
  const file = fd.get('file')
  if (!user || !orgId.success) return { error: 'Neplatná požiadavka.' }
  if (!DOC_KINDS.includes(kind)) return { error: 'Vyberte typ dokumentu.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Vyberte súbor.' }
  if (!DOC_TYPES.includes(file.type)) return { error: 'Povolené sú PDF, JPG a PNG.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'Súbor môže mať najviac 10 MB.' }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!(isPdf || isJpg || isPng)) return { error: 'Obsah súboru nezodpovedá povolenému formátu.' }

  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'dokument'
  const path = `${orgId.data}/${Date.now()}-${safe}`
  const supabase = await createClient()
  const { error: upErr } = await supabase.storage.from('org-documents').upload(path, bytes, { contentType: file.type })
  if (upErr) return { error: 'Súbor sa nepodarilo nahrať. Skontrolujte oprávnenie.' }
  const { error } = await supabase.from('organization_documents').insert({
    organization_id: orgId.data, kind, file_name: file.name.slice(0, 200), storage_path: path,
    size_bytes: file.size, uploaded_by: user.id,
  })
  if (error) {
    await supabase.storage.from('org-documents').remove([path])
    return { error: dbMessage(error) }
  }
  revalidatePath('/organization/documents')
  return { ok: 'Dokument bol nahraný.' }
}

export async function deleteOrgDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatný dokument.' }
  const supabase = await createClient()
  const { data: doc } = await supabase.from('organization_documents').select('storage_path').eq('id', id.data).maybeSingle()
  if (!doc) return { error: 'Dokument sa nenašiel.' }
  const { data, error } = await supabase.from('organization_documents').delete().eq('id', id.data).select('id')
  if (error) return { error: dbMessage(error) }
  if (!data || data.length === 0) return { error: 'Dokument už nie je možné odstrániť (žiadosť bola odoslaná).' }
  await supabase.storage.from('org-documents').remove([doc.storage_path])
  revalidatePath('/organization/documents')
  return { ok: 'Dokument bol odstránený.' }
}

const ORG_ROLE_KEYS = [
  'org_owner', 'org_chairman', 'org_vice_chairman', 'org_administrator', 'org_volunteer_manager',
  'org_event_manager', 'org_event_coordinator', 'org_team_leader', 'org_viewer',
]

export async function grantStaffRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const org = uuidSchema.safeParse(fd.get('org'))
  const email = emailSchema.safeParse(fd.get('email'))
  const role = String(fd.get('role') ?? '')
  if (!org.success || !email.success || !ORG_ROLE_KEYS.includes(role)) return { error: 'Skontrolujte e-mail a rolu.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('grant_role', { p_email: email.data, p_role_key: role, p_scope_type: 'organization', p_scope_id: org.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/organization/staff')
  return { ok: 'Rola bola pridelená.' }
}

export async function revokeStaffRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatné priradenie.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_role', { p_user_role_id: id.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/organization/staff')
  return { ok: 'Rola bola odobraná.' }
}

export async function inviteVolunteer(_: ActionState, fd: FormData): Promise<ActionState> {
  const org = uuidSchema.safeParse(fd.get('org'))
  const email = emailSchema.safeParse(fd.get('email'))
  if (!org.success || !email.success) return { error: 'Zadajte platný e-mail.' }
  const token = newToken()
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_invitation', { p_org: org.data, p_email: email.data, p_token_hash: sha256(token) })
  if (error) return { error: dbMessage(error) }
  const link = `${siteUrl()}/register?t=${token}`
  const { data: o } = await supabase.from('organizations').select('name').eq('id', org.data).single()
  const sent = await sendEmail(
    email.data,
    `Pozvánka do SDZ od organizácie ${o?.name ?? ''}`,
    `<p>Organizácia <strong>${escapeHtml(o?.name ?? '')}</strong> vás pozýva do Slovenského dobrovoľníckeho zväzu.</p>` +
      `<p><a href="${link}">Dokončiť registráciu</a></p><p>Pozvánka platí 14 dní.</p>`,
  )
  revalidatePath('/organization/registrations')
  return sent
    ? { ok: `Pozvánka bola odoslaná na ${email.data}.` }
    : { ok: 'Pozvánka bola vytvorená. E-mail sa neodoslal (nie je nastavený Resend), odkaz odošlite ručne.', link }
}

export async function decideTransfer(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const decision = String(fd.get('decision') ?? '')
  if (!id.success || !['approve', 'reject'].includes(decision)) return { error: 'Neplatná požiadavka.' }
  let reason: string | null = null
  if (decision === 'reject') {
    const r = reasonSchema.safeParse(fd.get('reason'))
    if (!r.success) return { error: 'Pri zamietnutí uveďte dôvod.' }
    reason = r.data
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('decide_transfer', { p_id: id.data, p_decision: decision, p_reason: reason })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/organization/transfers')
  return { ok: decision === 'approve' ? 'Prestup bol schválený.' : 'Prestup bol zamietnutý.' }
}

export async function decideGuesting(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  const decision = String(fd.get('decision') ?? '')
  if (!id.success || !['approve', 'reject'].includes(decision)) return { error: 'Neplatná požiadavka.' }
  let reason: string | null = null
  if (decision === 'reject') {
    const r = reasonSchema.safeParse(fd.get('reason'))
    if (!r.success) return { error: 'Pri zamietnutí uveďte dôvod.' }
    reason = r.data
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('decide_guesting', { p_id: id.data, p_decision: decision, p_reason: reason })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/organization/transfers')
  return { ok: decision === 'approve' ? 'Hosťovanie bolo schválené.' : 'Hosťovanie bolo zamietnuté.' }
}
