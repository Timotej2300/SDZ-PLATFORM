import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getContext, getUser } from '@/lib/auth'
import { SignUpForm } from '@/components/SignUpForm'
import { ActionForm } from '@/components/ActionForm'
import { Field, Select } from '@/components/ui'
import { createOrganizationDraft } from '@/actions/auth'
import { ORG_TYPE_LABELS } from '@/lib/labels'

export const metadata: Metadata = { title: 'Registrácia organizácie' }

export default async function Page() {
  const user = await getUser()
  if (!user) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold text-navy-900">Registrácia organizácie</h1>
        <p className="mt-2 text-sm text-ink-600">
          Žiadosť podáva koordinátor s SDZ účtom, ktorý má minimálne 20 rokov. Najprv si vytvorte účet.
        </p>
        <div className="mt-4"><SignUpForm purpose="organization" /></div>
        <p className="mt-4 text-sm">Už máte účet? <Link href="/login?next=/register/organization" className="text-navy-700 underline">Prihláste sa</Link>.</p>
      </div>
    )
  }
  const ctx = await getContext()
  if (ctx.orgs.length > 0) redirect('/organization')
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Nová organizácia</h1>
      <p className="mt-2 text-sm text-ink-600">
        Vytvoríte rozpracovanú žiadosť. Ďalšie údaje a dokumenty doplníte v profile organizácie a potom ju odošlete SDZ
        na schválenie. Podanie žiadosti automaticky neznamená schválenie.
      </p>
      <ActionForm action={createOrganizationDraft} submit="Vytvoriť žiadosť" className="mt-4">
        <Field label="Názov organizácie" name="name" required maxLength={160} />
        <Select
          label="Typ organizácie"
          name="type"
          required
          placeholder="Vyberte typ"
          options={Object.entries(ORG_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </ActionForm>
    </div>
  )
}
