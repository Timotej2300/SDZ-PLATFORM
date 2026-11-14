import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Field, PageHeader, Select, statusTone } from '@/components/ui'
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS } from '@/lib/labels'
import { saveOrgProfile, submitOrg } from '@/actions/org'

export const metadata = { title: 'Profil organizácie' }

type Org = {
  id: string; name: string; type: string; description: string | null; address: string | null; ico: string | null
  region_id: string | null; district_id: string | null; website: string | null; contact_email: string | null
  contact_phone: string | null; status: string; org_number: string | null
}

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('org.manage', org.id))) redirect('/organization')
  const supabase = await createClient()
  const [{ data }, { data: regions }, { data: districts }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', org.id).single(),
    supabase.from('regions').select('id,name').order('name'),
    supabase.from('districts').select('id,name,region_id').order('name'),
  ])
  const o = data as Org
  const editable = ['draft', 'needs_info', 'approved'].includes(o.status)
  const canSubmit = ['draft', 'needs_info'].includes(o.status)

  return (
    <div className="space-y-6">
      <PageHeader title="Profil organizácie"><Badge tone={statusTone(o.status)}>{ORG_STATUS_LABELS[o.status]}</Badge></PageHeader>
      {!editable && <p className="card">Profil nie je možné upravovať, kým žiadosť kontroluje SDZ.</p>}
      {editable && (
        <section className="card">
          <ActionForm action={saveOrgProfile} submit="Uložiť profil" className="max-w-2xl">
            <input type="hidden" name="id" value={o.id} />
            <Field label="Názov" name="name" defaultValue={o.name} required maxLength={160} />
            <Select label="Typ" name="type" defaultValue={o.type} required options={Object.entries(ORG_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
            <div className="mb-3">
              <label htmlFor="description" className="label">Popis</label>
              <textarea id="description" name="description" defaultValue={o.description ?? ''} maxLength={4000} className="input" />
            </div>
            <Field label="Adresa" name="address" defaultValue={o.address} maxLength={300} />
            <Field label="IČO (ak existuje)" name="ico" defaultValue={o.ico} maxLength={8} />
            <Select label="Kraj" name="region_id" defaultValue={o.region_id} required placeholder="Vyberte kraj" options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))} />
            <Select label="Okres" name="district_id" defaultValue={o.district_id} placeholder="— nevybraný —"
              options={((districts ?? []) as { id: string; name: string; region_id: string }[]).map((d) => ({ value: d.id, label: d.name }))} />
            <Field label="Webová stránka" name="website" type="url" defaultValue={o.website} hint="Začína http:// alebo https://" />
            <Field label="Kontaktný e-mail" name="contact_email" type="email" defaultValue={o.contact_email} required />
            <Field label="Kontaktný telefón" name="contact_phone" type="tel" defaultValue={o.contact_phone} maxLength={30} />
          </ActionForm>
        </section>
      )}
      {canSubmit && (
        <section className="card">
          <h2 className="font-semibold">Odoslať SDZ na schválenie</h2>
          <p className="mt-1 text-sm text-ink-600">Vyžaduje vyplnený profil (kraj, adresa, kontakt, popis), aspoň jeden nahratý dokument a koordinátora starého aspoň 20 rokov.</p>
          <ActionForm action={submitOrg} submit="Odoslať žiadosť" confirm="Odoslať žiadosť na kontrolu? Počas kontroly ju nebude možné upravovať.">
            <input type="hidden" name="id" value={o.id} />
          </ActionForm>
        </section>
      )}
    </div>
  )
}
