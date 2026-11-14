'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { sha256 } from '@/lib/server-utils'
import { dbMessage, type ActionState } from '@/lib/errors'
import { firstError, profileSchema, uuidSchema } from '@/lib/validation'

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: 'Nie ste prihlásený.' }
  const parsed = profileSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { error: firstError(parsed.error) }
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      birth_year: parsed.data.birth_year,
      phone: parsed.data.phone ?? null,
    })
    .eq('id', user.id)
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account', 'layout')
  return { ok: 'Profil bol uložený.' }
}

const MAX_AVATAR = 2 * 1024 * 1024
const AVATAR_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function uploadAvatar(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: 'Nie ste prihlásený.' }
  const file = fd.get('avatar')
  if (!(file instanceof File) || file.size === 0) return { error: 'Vyberte súbor.' }
  const ext = AVATAR_TYPES[file.type]
  if (!ext) return { error: 'Povolené sú iba obrázky JPG, PNG alebo WebP.' }
  if (file.size > MAX_AVATAR) return { error: 'Fotografia môže mať najviac 2 MB.' }

  // kontrola skutočného obsahu (magic bytes), nielen deklarovaného typu
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45
  if (!(isJpg || isPng || isWebp)) return { error: 'Súbor nie je platný obrázok.' }

  const supabase = await createClient()
  const path = `${user.id}/avatar-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: file.type })
  if (upErr) return { error: 'Fotografiu sa nepodarilo nahrať.' }

  const { data: prev } = await supabase.from('profiles').select('avatar_path').eq('id', user.id).single()
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id)
  if (error) {
    await supabase.storage.from('avatars').remove([path])
    return { error: dbMessage(error) }
  }
  if (prev?.avatar_path) await supabase.storage.from('avatars').remove([prev.avatar_path])
  revalidatePath('/account', 'layout')
  return { ok: 'Fotografia bola zmenená.' }
}

export async function updatePrivacy(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: 'Nie ste prihlásený.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('volunteers')
    .update({
      public_show_photo: fd.get('photo') === 'on',
      public_show_organization: fd.get('organization') === 'on',
      public_show_transfer_history: fd.get('transfers') === 'on',
      public_show_history: fd.get('history') === 'on',
    })
    .eq('profile_id', user.id)
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account/profile')
  return { ok: 'Nastavenie súkromia bolo uložené.' }
}

export async function renewLicense(): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('renew_license')
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account', 'layout')
  return { ok: 'Licencia bola obnovená.' }
}

export async function requestTransfer(_: ActionState, fd: FormData): Promise<ActionState> {
  const org = uuidSchema.safeParse(fd.get('organization'))
  if (!org.success) return { error: 'Vyberte cieľovú organizáciu.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_transfer', { p_to: org.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account/transfers')
  return { ok: 'Žiadosť o prestup bola odoslaná pôvodnej organizácii.' }
}

export async function cancelTransfer(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná žiadosť.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_transfer', { p_id: id.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account/transfers')
  return { ok: 'Žiadosť bola zrušená.' }
}

export async function requestGuesting(_: ActionState, fd: FormData): Promise<ActionState> {
  const org = uuidSchema.safeParse(fd.get('organization'))
  const start = String(fd.get('start') ?? '')
  const end = String(fd.get('end') ?? '')
  if (!org.success) return { error: 'Vyberte hosťujúcu organizáciu.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { error: 'Zadajte dátum začiatku a konca.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_guesting', { p_host: org.data, p_start: start, p_end: end })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account/organizations')
  return { ok: 'Žiadosť o hosťovanie bola odoslaná domovskej organizácii.' }
}

export async function cancelGuesting(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná žiadosť.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_guesting', { p_id: id.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account/organizations')
  return { ok: 'Hosťovanie bolo zrušené.' }
}

export async function resubmitRegistration(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(fd.get('id'))
  if (!id.success) return { error: 'Neplatná žiadosť.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('resubmit_registration', { p_id: id.data })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account')
  return { ok: 'Registrácia bola znova odoslaná na kontrolu.' }
}

export async function claimInvitation(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get('token') ?? '').trim()
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { error: 'Neplatný kód pozvánky.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('claim_invitation', { p_hash: sha256(token) })
  if (error) return { error: dbMessage(error) }
  revalidatePath('/account')
  return { ok: 'Pozvánka bola uplatnená. Registráciu teraz skontroluje SDZ.' }
}
