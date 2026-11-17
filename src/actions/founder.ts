'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbMessage, type ActionState } from '@/lib/errors'
import { emailSchema, uuidSchema } from '@/lib/validation'

/** Každá Founder akcia znovu overuje, že volajúci je Founder s AAL2 (nestačí skryté tlačidlo). */
async function founderGuard() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') return null
  const { data: isF } = await supabase.rpc('i_am_founder')
  if (isF !== true) return null
  return { supabase, userId: user.user.id }
}

const DENIED: ActionState = { error: 'Na túto akciu nemáte oprávnenie.' }

export async function createRoleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const key = String(fd.get('key') ?? '').trim()
  const name = String(fd.get('name') ?? '').trim()
  const scope = String(fd.get('scope') ?? '')
  if (!/^[a-z][a-z_]{1,40}$/.test(key) || name.length < 2 || name.length > 80 || !['system', 'region', 'organization', 'event'].includes(scope))
    return { error: 'Kľúč: malé písmená a podčiarkovník; názov: 2–80 znakov.' }
  const { error } = await g.supabase.rpc('create_role', { p_key: key, p_name: name, p_scope: scope })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/founder/roles')
  return { ok: 'Rola bola vytvorená. Oprávnenia jej nastavíte nižšie.' }
}

export async function setRolePermissionsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const role = String(fd.get('role') ?? '')
  const keys = fd.getAll('perm').map(String)
  if (!/^[a-z][a-z_]*$/.test(role)) return { error: 'Neplatná rola.' }
  const { error } = await g.supabase.rpc('set_role_permissions', { p_role_key: role, p_keys: keys })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/founder/roles')
  return { ok: 'Oprávnenia roly boli uložené a zapísané do auditu.' }
}

export async function grantSystemRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const email = emailSchema.safeParse(fd.get('email'))
  const role = String(fd.get('role') ?? '')
  if (!email.success || !/^[a-z][a-z_]*$/.test(role)) return { error: 'Zadajte e-mail a rolu.' }
  const { error } = await g.supabase.rpc('grant_role', { p_email: email.data, p_role_key: role, p_scope_type: 'system', p_scope_id: null })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/founder/administrators')
  return { ok: 'Rola bola pridelená. Používateľ musí mať zapnuté dvojfaktorové overenie.' }
}

export async function revokeSystemRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatné priradenie.' }
  const { error } = await g.supabase.rpc('revoke_role', { p_user_role_id: id.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/founder/administrators')
  return { ok: 'Rola bola odobraná.' }
}

export async function setUserBan(_: ActionState, fd: FormData): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const id = uuidSchema.safeParse(fd.get('id'))
  const ban = fd.get('ban') === '1'
  if (!id.success) return { error: 'Neplatný používateľ.' }
  if (id.data === g.userId) return { error: 'Vlastný účet nie je možné zablokovať.' }
  const admin = createAdminClient()
  const { data: target } = await admin.from('user_roles').select('id, roles!inner(key)').eq('user_id', id.data).eq('roles.key', 'founder').is('revoked_at', null)
  if (target && target.length > 0) return { error: 'Účet Foundera je chránený.' }
  const { error } = await admin.auth.admin.updateUserById(id.data, { ban_duration: ban ? '876000h' : 'none' })
  if (error) return { error: 'Zmenu stavu účtu sa nepodarilo vykonať.' }
  await admin.from('audit_logs').insert({
    actor_id: g.userId, severity: 'critical', action: ban ? 'user.banned' : 'user.unbanned',
    entity_type: 'profiles', entity_id: id.data,
  })
  revalidatePath('/founder/users')
  return { ok: ban ? 'Účet bol zablokovaný.' : 'Účet bol odblokovaný.' }
}

export async function runMaintenance(): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('run_daily_maintenance')
  if (error) return { error: 'Údržbu sa nepodarilo spustiť.' }
  const r = data as Record<string, number>
  await admin.from('audit_logs').insert({
    actor_id: g.userId, severity: 'info', action: 'maintenance.manual_run', entity_type: 'system', new_data: r,
  })
  return {
    ok: `Hotovo: licencie blížiace sa k expirácii ${r.licenses_expiring}, expirované ${r.licenses_expired}, prestupy po lehote ${r.transfers_overdue}, ukončené hosťovania ${r.guestings_ended}.`,
  }
}

export async function setModule(_: ActionState, fd: FormData): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const key = String(fd.get('key') ?? '')
  if (!/^[a-z_]{2,40}$/.test(key)) return { error: 'Neplatná požiadavka.' }
  const supabase = g.supabase
  const { error } = await supabase.rpc('set_module', { p_key: key, p_enabled: fd.get('enabled') === '1' })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/', 'layout')
  return { ok: 'Nastavenie modulu bolo uložené.' }
}

export async function saveBranding(_: ActionState, fd: FormData): Promise<ActionState> {
  const g = await founderGuard()
  if (!g) return DENIED
  const name = String(fd.get('name') ?? '').trim()
  const short = String(fd.get('short') ?? '').trim()
  const tagline = String(fd.get('tagline') ?? '').trim()
  if (name.length < 2 || name.length > 80) return { error: 'Názov musí mať 2 až 80 znakov.' }
  if (short.length < 1 || short.length > 4) return { error: 'Skratka musí mať 1 až 4 znaky.' }
  if (tagline.length > 160) return { error: 'Slogan môže mať najviac 160 znakov.' }
  const supabase = g.supabase
  const { error } = await supabase.rpc('save_branding', { p_name: name, p_short: short, p_tagline: tagline })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/', 'layout')
  return { ok: 'Vizuálna identita bola uložená.' }
}
