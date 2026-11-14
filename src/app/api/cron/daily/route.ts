import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  if (!authorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('run_daily_maintenance')
  if (error) return NextResponse.json({ error: 'maintenance_failed' }, { status: 500 })
  await admin.from('audit_logs').insert({ severity: 'info', action: 'maintenance.cron_run', entity_type: 'system', new_data: data })
  return NextResponse.json({ ok: true, result: data })
}
