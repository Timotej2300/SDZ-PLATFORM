import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionForm } from '@/components/ActionForm'
import { Field } from '@/components/ui'
import { login } from '@/actions/auth'

export const metadata: Metadata = { title: 'Prihlásenie' }

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = '', error } = await searchParams
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Prihlásenie</h1>
      {error === 'link' && (
        <p role="alert" className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
          Odkaz je neplatný alebo expiroval. Prihláste sa, prípadne požiadajte o nový.
        </p>
      )}
      <ActionForm action={login} submit="Prihlásiť sa" className="mt-4">
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" name="email" type="email" required autoComplete="email" />
        <Field label="Heslo" name="password" type="password" required autoComplete="current-password" />
      </ActionForm>
      <p className="mt-4 text-sm"><Link href="/forgot-password" className="text-navy-700 underline">Zabudli ste heslo?</Link></p>
      <p className="mt-2 text-sm text-ink-600">
        Registrácia dobrovoľníka prebieha cez pozvánku organizácie. Organizáciu môžete{' '}
        <Link href="/register/organization" className="text-navy-700 underline">zaregistrovať tu</Link>.
      </p>
    </div>
  )
}
