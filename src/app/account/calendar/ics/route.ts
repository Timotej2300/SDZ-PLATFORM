import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '')

export async function GET() {
  const supabase = await createClient()
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))
  const { data: vol } = await supabase.from('volunteers').select('id').eq('profile_id', u.user.id).maybeSingle()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SDZ//Kalendar//SK', 'CALSCALE:GREGORIAN']
  if (vol) {
    const { data } = await supabase.from('applications')
      .select('id,events!inner(title,location,starts_at,ends_at,status)')
      .eq('volunteer_id', vol.id).in('status', ['approved', 'assigned'])
    for (const a of (data ?? []) as unknown as { id: string; events: { title: string; location: string | null; starts_at: string; ends_at: string; status: string } }[]) {
      if (a.events.status === 'cancelled') continue
      lines.push('BEGIN:VEVENT', `UID:${a.id}@sdz.sk`, `DTSTAMP:${stamp(new Date().toISOString())}`,
        `DTSTART:${stamp(new Date(a.events.starts_at).toISOString())}`, `DTEND:${stamp(new Date(a.events.ends_at).toISOString())}`,
        `SUMMARY:${esc(a.events.title)}`, ...(a.events.location ? [`LOCATION:${esc(a.events.location)}`] : []), 'END:VEVENT')
    }
  }
  lines.push('END:VCALENDAR')
  return new NextResponse(lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="sdz-kalendar.ics"', 'Cache-Control': 'no-store' },
  })
}
