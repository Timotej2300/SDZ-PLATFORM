import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionForm } from '@/components/ActionForm'
import { Field } from '@/components/ui'
import { forgotPassword } from '@/actions/auth'

export const metadata: Metadata = { title: 'Obnova hesla' }

export default function Page() {
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Obnova hesla</h1>
      <ActionForm action={forgotPassword} submit="Poslať odkaz" className="mt-4">
        <Field label="E-mail" name="email" type="email" required autoComplete="email" />
      </ActionForm>
      <p className="mt-4 text-sm"><Link href="/login" className="text-navy-700 underline">Späť na prihlásenie</Link></p>
    </div>
  )
}
