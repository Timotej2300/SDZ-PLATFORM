import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getContext, getUser } from '@/lib/auth'
import { SignUpForm } from '@/components/SignUpForm'
import { ActionForm } from '@/components/ActionForm'
import { Field, Select } from '@/components/ui'
import { applyOrganization } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { ORG_TYPE_LABELS } from '@/lib/labels'

export const metadata: Metadata = { title: 'Žiadosť organizácie' }

export default async function Page() {
  const user = await getUser()
  if (!user) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold text-navy-900">Žiadosť organizácie</h1>
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
  const supabase = await createClient()
  const { data: regions } = await supabase.from('regions').select('id,name').order('name')
  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Žiadosť o zaradenie organizácie do SDZ</h1>
      <p className="mt-2 text-sm text-ink-600">
        Vyplňte žiadosť písomne a odošlite ju SDZ. Licenciu ani dokumenty zatiaľ nepotrebujete – ak bude niečo treba doplniť,
        SDZ vás o to požiada. Odoslanie žiadosti neznamená schválenie; o výsledku vás budeme informovať.
      </p>
      <ActionForm action={applyOrganization} submit="Odoslať žiadosť SDZ" className="mt-4">
        <Field label="Názov organizácie" name="name" required maxLength={160} />
        <Select label="Typ organizácie" name="type" required placeholder="Vyberte typ"
          options={Object.entries(ORG_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <Select label="Kraj pôsobenia" name="region" required placeholder="Vyberte kraj"
          options={((regions ?? []) as { id: string; name: string }[]).map((r) => ({ value: r.id, label: r.name }))} />
        <Field label="Adresa / sídlo" name="address" required maxLength={300} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kontaktný e-mail" name="email" type="email" required maxLength={200} />
          <Field label="Telefón (nepovinné)" name="phone" maxLength={30} />
        </div>
        <div className="mb-3">
          <label htmlFor="description" className="label">Čomu sa organizácia venuje *</label>
          <textarea id="description" name="description" required minLength={20} maxLength={4000} rows={5} className="input" />
        </div>
        <div className="mb-3">
          <label htmlFor="message" className="label">Správa pre SDZ (nepovinné)</label>
          <textarea id="message" name="message" maxLength={4000} rows={4} className="input"
            placeholder="Prečo chcete byť súčasťou SDZ, koľko dobrovoľníkov plánujete zapojiť a podobne." />
        </div>
      </ActionForm>
    </div>
  )
}
