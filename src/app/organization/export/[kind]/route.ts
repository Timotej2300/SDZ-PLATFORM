import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/auth'
import { csvResponse } from '@/lib/csv'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!['org_volunteers', 'org_attendance'].includes(kind)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { org } = await getCurrentOrg()
  if (!org) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('export_rows', { p_kind: kind, p_org: org.id })
  if (error) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return csvResponse(kind.replace('_', '-'), data as Record<string, unknown>[])
}
