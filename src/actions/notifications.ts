'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dbMessage, type ActionState } from '@/lib/errors'
import { uuidSchema } from '@/lib/validation'
import { localToIso } from '@/lib/events'
import { NOTIFICATION_GROUPS } from '@/lib/labels'

const refresh = () => {
  revalidatePath('/account', 'layout')
  revalidatePath('/organization', 'layout')
  revalidatePath('/admin', 'layout')
}

export async function markRead(_: ActionState, fd: FormData): Promise<ActionState> {
  const raw = String(fd.get('id') ?? '')
  const id = raw ? uuidSchema.safeParse(raw) : null
  if (id && !id.success) return { error: 'Neplatná požiadavka.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_notification_read', { p_id: id?.data ?? null })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Hotovo.' }
}

export async function savePrefs(_: ActionState, fd: FormData): Promise<ActionState> {
  const muted = NOTIFICATION_GROUPS.map(([k]) => k).filter((k) => fd.get(`n_${k}`) !== 'on')
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_notification_prefs', { p_email: fd.get('email') === 'on', p_muted: muted })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Nastavenia boli uložené.' }
}

export async function publishAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const title = String(fd.get('title') ?? '').trim()
  const body = String(fd.get('body') ?? '').trim()
  const audience = String(fd.get('audience') ?? '')
  if (title.length < 3 || body.length < 3) return { error: 'Vyplňte nadpis aj text oznamu.' }
  if (!['all', 'volunteers', 'org_staff'].includes(audience)) return { error: 'Vyberte adresátov.' }
  const expRaw = String(fd.get('expires') ?? '').trim()
  const expires = expRaw ? localToIso(expRaw) : null
  if (expRaw && !expires) return { error: 'Neplatný dátum platnosti.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('publish_announcement', {
    p_title: title, p_body: body, p_audience: audience, p_email: fd.get('email') === 'on', p_expires: expires,
  })
  if (error) return { error: dbMessage(error) }
  refresh()
  return { ok: 'Oznam bol zverejnený a odoslaný.' }
}
