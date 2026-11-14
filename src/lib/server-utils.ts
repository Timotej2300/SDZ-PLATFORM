import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/** true = povolené, false = prekročený limit */
export async function rateLimit(action: string, limit: number, windowSeconds: number): Promise<boolean> {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  const key = `${action}:${sha256((process.env.RATE_LIMIT_SALT ?? '') + ip)}`
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rate_limit_hit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) return true // pri výpadku limitera neblokujeme prihlásenie
  return data === true
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const { Resend } = await import('resend')
  const resend = new Resend(key)
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SDZ <no-reply@sdz.sk>',
    to,
    subject,
    html,
  })
  return !error
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
