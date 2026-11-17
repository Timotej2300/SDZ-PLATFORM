import { getBranding } from '@/lib/branding'
import { ActionForm } from '@/components/ActionForm'
import { Field, PageHeader } from '@/components/ui'
import { saveBranding } from '@/actions/founder'

export const metadata = { title: 'Vizuálna identita' }

export default async function Page() {
  const b = await getBranding()
  return (
    <div className="space-y-6">
      <PageHeader title="Vizuálna identita" intro="Názov, skratka a slogan sa zobrazujú v hlavičke, pätičke a navigácii portálov. Farby a logo zatiaľ zostávajú pevné." />
      <section className="card max-w-xl">
        <ActionForm action={saveBranding} submit="Uložiť">
          <Field label="Názov organizácie" name="name" defaultValue={b.name} required maxLength={80} />
          <Field label="Skratka v logu (1–4 znaky)" name="short" defaultValue={b.short} required maxLength={4} />
          <Field label="Slogan v pätičke" name="tagline" defaultValue={b.tagline} maxLength={160} />
        </ActionForm>
      </section>
    </div>
  )
}
