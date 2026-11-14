'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dbMessage, type ActionState } from '@/lib/errors'
import { loginSchema, signUpSchema, emailSchema, passwordSchema, firstError, slugify, orgCreateSchema } from '@/lib/validation'
import { rateLimit, sha256, siteUrl } from '@/lib/server-utils'

const GENERIC_LOGIN_ERROR = 'Nesprávny e-mail alebo heslo.'

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === 'string' ? v : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/account'
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimit('login', 10, 600))) return { error: 'Príliš veľa pokusov. Skúste to o niekoľko minút.' }
  const parsed = loginSchema.safeParse({ email: fd.get('email'), password: fd.get('password') })
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.message.toLowerCase().includes('not confirmed'))
      return { error: 'E-mail ešte nie je overený. Skontrolujte schránku a kliknite na overovací odkaz.' }
    return { error: GENERIC_LOGIN_ERROR }
  }
  redirect(safeNext(fd.get('next')))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

/** Registrácia dobrovoľníka (s pozvánkou) alebo koordinátora organizácie (bez pozvánky). */
export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimit('signup', 5, 3600))) return { error: 'Príliš veľa pokusov. Skúste to neskôr.' }
  const parsed = signUpSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { error: firstError(parsed.error) }
  const token = String(fd.get('token') ?? '')
  const purpose = String(fd.get('purpose') ?? '')
  const supabase = await createClient()

  const data: Record<string, unknown> = {
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    birth_year: parsed.data.birth_year,
  }
  let next = '/account'
  if (token) {
    const hash = sha256(token)
    const { data: inv } = await supabase.rpc('lookup_invitation', { p_hash: hash })
    if (!inv) return { error: 'Pozvánka je neplatná alebo expirovaná.' }
    if ((inv as { email: string }).email !== parsed.data.email)
      return { error: 'Registrovať sa môžete iba s e-mailom, na ktorý bola pozvánka vystavená.' }
    data.invitation_hash = hash
  } else if (purpose === 'organization') {
    next = '/register/organization'
  } else {
    return { error: 'Registrácia dobrovoľníka je možná iba cez pozvánku organizácie.' }
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data, emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error) {
    if (/password|weak|pwned/i.test(error.message)) return { error: 'Heslo je príliš slabé alebo uniknuté. Zvoľte iné.' }
    return { error: 'Registráciu sa nepodarilo dokončiť. Skúste to znova.' }
  }
  redirect('/verify-email')
}

export async function forgotPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimit('forgot', 5, 3600))) return { error: 'Príliš veľa pokusov. Skúste to neskôr.' }
  const email = emailSchema.safeParse(fd.get('email'))
  if (!email.success) return { error: 'Zadajte platný e-mail.' }
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  })
  // rovnaká odpoveď bez ohľadu na to, či účet existuje
  return { ok: 'Ak účet s týmto e-mailom existuje, poslali sme naň odkaz na obnovu hesla.' }
}

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const pw = passwordSchema.safeParse(fd.get('password'))
  if (!pw.success) return { error: firstError(pw.error) }
  if (fd.get('password') !== fd.get('password2')) return { error: 'Heslá sa nezhodujú.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: pw.data })
  if (error) return { error: 'Heslo sa nepodarilo zmeniť. Odkaz mohol expirovať, požiadajte o nový.' }
  redirect('/account')
}

export async function createOrganizationDraft(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = orgCreateSchema.safeParse({ name: fd.get('name'), type: fd.get('type') })
  if (!parsed.success) return { error: firstError(parsed.error) }
  const supabase = await createClient()
  const base = slugify(parsed.data.name)
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`
    const { error } = await supabase.rpc('create_organization', {
      p_name: parsed.data.name,
      p_type: parsed.data.type,
      p_slug: slug,
    })
    if (!error) redirect('/organization/profile')
    if (!String(error.message).includes('DUPLICATE')) return { error: dbMessage(error) }
  }
  return { error: 'Nepodarilo sa vytvoriť jedinečnú adresu organizácie. Skúste upraviť názov.' }
}
