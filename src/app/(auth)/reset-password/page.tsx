import type { Metadata } from 'next'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field } from '@/components/ui'
import { resetPassword } from '@/actions/auth'

export const metadata: Metadata = { title: 'Nové heslo' }

export default async function Page() {
  const user = await getUser()
  if (!user) {
    return (
      <div className="card">
        <p className="text-sm">Odkaz na obnovu hesla je neplatný alebo expiroval.</p>
        <Link href="/forgot-password" className="btn-primary mt-4">Požiadať o nový odkaz</Link>
      </div>
    )
  }
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Nové heslo</h1>
      <ActionForm action={resetPassword} submit="Zmeniť heslo" className="mt-4">
        <Field label="Nové heslo" name="password" type="password" required autoComplete="new-password" hint="Aspoň 12 znakov, písmeno aj číslica." />
        <Field label="Zopakujte heslo" name="password2" type="password" required autoComplete="new-password" />
      </ActionForm>
    </div>
  )
}
