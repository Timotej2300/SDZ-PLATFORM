import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Overenie e-mailu' }

export default function Page() {
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Skontrolujte e-mail</h1>
      <p className="mt-3 text-sm text-ink-600">
        Poslali sme vám overovací odkaz. Po jeho otvorení budete prihlásený a môžete pokračovať. Ak e-mail nevidíte,
        pozrite aj spam.
      </p>
      <Link href="/login" className="btn-secondary mt-4">Na prihlásenie</Link>
    </div>
  )
}
