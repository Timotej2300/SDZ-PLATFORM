import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) return NextResponse.json({ error: 'export_failed' }, { status: 500 })
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="moje-udaje-sdz.json"', 'Cache-Control': 'no-store' },
  })
}
