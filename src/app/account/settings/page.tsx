import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Nastavenia' }

export default async function Page() {
  const p = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const totp = data?.totp?.some((f) => f.status === 'verified')
  return (
    <div className="space-y-6">
      <PageHeader title="Nastavenia" />
      <section className="card">
        <h2 className="font-semibold">Prihlasovací e-mail</h2>
        <p className="mt-1 text-sm">{p.email}</p>
      </section>
      <section className="card">
        <h2 className="font-semibold">Dvojfaktorové overenie (TOTP)</h2>
        <p className="mt-1 text-sm text-ink-600">
          Stav: {totp ? 'zapnuté' : 'vypnuté'}. Pre centrálnu administráciu a Founder Control Center je povinné.
        </p>
        {!totp && <Link href="/mfa?next=/account/settings" className="btn-secondary mt-3">Zapnúť dvojfaktorové overenie</Link>}
      </section>
      <section className="card">
        <h2 className="font-semibold">Heslo</h2>
        <Link href="/forgot-password" className="btn-secondary mt-3">Zmeniť heslo e-mailom</Link>
      </section>
    </div>
  )
}
