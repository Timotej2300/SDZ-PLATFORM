import { createClient } from '@/lib/supabase/server'
import { requireOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, Field, PageHeader } from '@/components/ui'
import { FIELD_TYPE_LABELS, fmtDate } from '@/lib/labels'
import { fieldsToText, type FormField } from '@/lib/events'
import { archiveForm, saveForm } from '@/actions/events'

export const metadata = { title: 'Dynamické formuláre' }

type F = { id: string; name: string; description: string | null; archived: boolean; updated_at: string; form_versions: { id: string; version: number; fields: FormField[] }[] }

const HELP = `text | Telefón | *
textarea | Prečo sa chcete zapojiť? | *
select | Veľkosť trička | | S, M, L, XL
checkbox | Súhlasím s pravidlami | *
date | Dátum príchodu
number | Počet osôb`

export default async function Page() {
  const org = await requireOrgPermission('forms.manage')
  const supabase = await createClient()
  const { data } = await supabase.from('forms').select('id,name,description,archived,updated_at,form_versions(id,version,fields)')
    .eq('organization_id', org.id).order('created_at', { ascending: false })
  const forms = (data ?? []) as unknown as F[]
  const help = (
    <details className="mb-3 text-sm">
      <summary className="cursor-pointer font-semibold">Ako zapísať polia</summary>
      <p className="mt-2 text-ink-600">Jeden riadok = jedno pole v tvare <code>typ | názov | * | možnosti</code>. Hviezdička znamená povinné pole, možnosti sa píšu iba pri výbere a oddeľujú čiarkou. Typy: {Object.keys(FIELD_TYPE_LABELS).join(', ')}.</p>
      <pre className="mt-2 overflow-x-auto rounded-md bg-gray-100 p-3 text-xs">{HELP}</pre>
    </details>
  )

  return (
    <div className="space-y-8">
      <PageHeader title="Dynamické formuláre" intro="Každá úprava vytvorí novú verziu. Podujatia, ktoré už formulár používajú, ostávajú na pôvodnej verzii." />
      {forms.length === 0 ? <Empty title="Zatiaľ nemáte žiadny formulár" /> : (
        <div className="space-y-4">
          {forms.map((f) => {
            const latest = [...f.form_versions].sort((a, b) => b.version - a.version)[0]
            return (
              <details key={f.id} className="card">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 font-semibold">
                  {f.name}
                  <Badge tone="blue">verzia {latest?.version ?? 0}</Badge>
                  {f.archived && <Badge tone="gray">Archivovaný</Badge>}
                  <span className="text-xs font-normal text-ink-600">upravený {fmtDate(f.updated_at)}</span>
                </summary>
                <div className="mt-4">
                  {help}
                  <ActionForm action={saveForm} submit="Uložiť ako novú verziu">
                    <input type="hidden" name="id" value={f.id} />
                    <Field label="Názov formulára" name="name" defaultValue={f.name} required maxLength={160} />
                    <div className="mb-3">
                      <label htmlFor={`fields-${f.id}`} className="label">Polia</label>
                      <textarea id={`fields-${f.id}`} name="fields" defaultValue={fieldsToText(latest?.fields ?? [])} className="input font-mono" rows={8} />
                    </div>
                  </ActionForm>
                  <ActionForm action={archiveForm} submit={f.archived ? 'Obnoviť formulár' : 'Archivovať formulár'} variant="secondary" className="mt-3">
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="archive" value={f.archived ? '0' : '1'} />
                  </ActionForm>
                </div>
              </details>
            )
          })}
        </div>
      )}
      <section className="card">
        <h2 className="mb-3 font-semibold">Nový formulár</h2>
        {help}
        <ActionForm action={saveForm} submit="Vytvoriť formulár" resetOnSuccess className="max-w-2xl">
          <Field label="Názov formulára" name="name" required maxLength={160} />
          <div className="mb-3">
            <label htmlFor="fields-new" className="label">Polia</label>
            <textarea id="fields-new" name="fields" className="input font-mono" rows={8} placeholder={HELP} />
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
