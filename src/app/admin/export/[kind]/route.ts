import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { csvResponse } from '@/lib/csv'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!['central_organizations', 'central_events'].includes(kind)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const supabase = await createClient()
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') return NextResponse.json({ error: 'mfa_required' }, { status: 403 })
  const { data, error } = await supabase.rpc('export_rows', { p_kind: kind })
  if (error) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return csvResponse(kind.replace('_', '-'), data as Record<string, unknown>[])
}
