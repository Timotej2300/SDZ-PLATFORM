import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type OrgCtx = { id: string; name: string; slug: string; status: string; roles: string[] }
export type Ctx = {
  is_founder: boolean
  system_roles: string[]
  orgs: OrgCtx[]
  volunteer_id: string | null
}
export type Profile = {
  id: string
  email: string
  first_name: string
  last_name: string
  birth_year: number | null
  avatar_path: string | null
  phone: string | null
}

export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
})

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id,email,first_name,last_name,birth_year,avatar_path,phone')
    .eq('id', user.id)
    .single()
  return (data as Profile | null) ?? null
})

export const getContext = cache(async (): Promise<Ctx> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_context')
  const c = (data ?? {}) as Partial<Ctx>
  return {
    is_founder: c.is_founder === true,
    system_roles: c.system_roles ?? [],
    orgs: c.orgs ?? [],
    volunteer_id: c.volunteer_id ?? null,
  }
})

export async function requireUser(): Promise<Profile> {
  const user = await getUser()
  if (!user) redirect('/login')
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

export async function hasPermission(key: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_permission', { p_key: key })
  return data === true
}

export async function hasOrgPermission(key: string, orgId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_permission', {
    p_key: key,
    p_scope: 'organization',
    p_scope_id: orgId,
  })
  return data === true
}

/** Centrálne rozhrania vyžadujú rolu a dvojfaktorové overenie (AAL2). */
export async function requireCentral(next: string): Promise<Ctx> {
  await requireUser()
  const ctx = await getContext()
  if (!ctx.is_founder && ctx.system_roles.length === 0) redirect('/account')
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (data?.currentLevel !== 'aal2') redirect(`/mfa?next=${encodeURIComponent(next)}`)
  return ctx
}

export async function requireFounder(next = '/founder'): Promise<Ctx> {
  const ctx = await requireCentral(next)
  if (!ctx.is_founder) redirect('/account')
  return ctx
}

export async function requirePermission(key: string, next: string): Promise<Ctx> {
  const ctx = await requireCentral(next)
  if (!(await hasPermission(key))) redirect('/admin')
  return ctx
}

export const ORG_COOKIE = 'sdz_org'

export async function getCurrentOrg(): Promise<{ ctx: Ctx; org: OrgCtx | null }> {
  await requireUser()
  const ctx = await getContext()
  const store = await cookies()
  const wanted = store.get(ORG_COOKIE)?.value
  const org = ctx.orgs.find((o) => o.id === wanted) ?? ctx.orgs[0] ?? null
  return { ctx, org }
}

/** Stránky organizačného portálu: vyžadujú aktuálnu organizáciu a jedno z oprávnení. */
export async function requireOrgPermission(...keys: string[]): Promise<OrgCtx> {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  for (const k of keys) {
    if (await hasOrgPermission(k, org.id)) return org
  }
  redirect('/organization')
}
