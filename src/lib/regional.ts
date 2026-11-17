import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export const REGION_COOKIE = 'sdz_region'
export type Region = { id: string; code: string; name: string }

export const myRegions = cache(async (): Promise<Region[]> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_regions')
  return (data ?? []) as Region[]
})

export async function requireRegion(): Promise<{ regions: Region[]; region: Region }> {
  await requireUser()
  const regions = await myRegions()
  if (regions.length === 0) redirect('/account')
  const wanted = (await cookies()).get(REGION_COOKIE)?.value
  return { regions, region: regions.find((r) => r.id === wanted) ?? regions[0] }
}
