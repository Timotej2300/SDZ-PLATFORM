import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SignUpForm } from '@/components/SignUpForm'
import { sha256 } from '@/lib/server-utils'

export const metadata: Metadata = { title: 'Registrácia dobrovoľníka' }

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = '' } = await searchParams
  let inv = null as { email: string; organization: string } | null
  if (/^[A-Za-z0-9_-]{20,100}$/.test(t)) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('lookup_invitation', { p_hash: sha256(t) })
    inv = (data as { email: string; organization: string } | null) ?? null
  }

  if (!inv) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold text-navy-900">Registrácia dobrovoľníka</h1>
        <p className="mt-3 text-sm text-ink-600">
          Registrácia dobrovoľníka nie je voľne otvorená. Iniciuje ju vaša organizácia pozvánkou, ktorú dostanete e-mailom.
          {t ? ' Použitý odkaz je neplatný alebo expiroval – požiadajte organizáciu o novú pozvánku.' : ''}
        </p>
        <p className="mt-3 text-sm">
          Už máte účet? <Link href="/login" className="text-navy-700 underline">Prihláste sa</Link>.
        </p>
      </div>
    )
  }
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Registrácia dobrovoľníka</h1>
      <p className="mt-2 text-sm text-ink-600">
        Pozvánka od organizácie <strong>{inv.organization}</strong>. Po overení e-mailu vašu registráciu skontroluje SDZ.
      </p>
      <div className="mt-4"><SignUpForm token={t} email={inv.email} /></div>
    </div>
  )
}
