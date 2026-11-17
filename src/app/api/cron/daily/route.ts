import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, escapeHtml } from '@/lib/server-utils'

export const dynamic = 'force-dynamic'

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

type Outbox = { id: string; to_email: string; subject: string; body: string }

export async function GET(request: NextRequest) {
  if (!authorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('run_daily_maintenance')
  if (error) return NextResponse.json({ error: 'maintenance_failed' }, { status: 500 })
  const { data: susp } = await admin.rpc('apply_suspensions')

  // fronta e-mailov (Resend); bez RESEND_API_KEY zostávajú správy vo fronte
  let sent = 0
  let failed = 0
  if (process.env.RESEND_API_KEY) {
    const { data: batch } = await admin.rpc('claim_outbox', { p_limit: 100 })
    for (const m of (batch ?? []) as Outbox[]) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2>${escapeHtml(m.subject)}</h2><p>${escapeHtml(m.body).replace(/\n/g, '<br>')}</p><hr><p style="color:#666;font-size:12px">Slovenský dobrovoľnícky zväz · Nastavenie oznámení: ${escapeHtml(process.env.NEXT_PUBLIC_SITE_URL ?? '')}/account/notifications</p></div>`
      const ok = await sendEmail(m.to_email, m.subject, html).catch(() => false)
      await admin.rpc('finish_outbox', { p_id: m.id, p_ok: ok, p_error: ok ? null : 'send_failed' })
      if (ok) sent++
      else failed++
    }
  }
  const result = { ...(data as object), ...(susp as object), emails_sent: sent, emails_failed: failed }
  await admin.from('audit_logs').insert({ severity: 'info', action: 'maintenance.cron_run', entity_type: 'system', new_data: result })
  return NextResponse.json({ ok: true, result })
}
