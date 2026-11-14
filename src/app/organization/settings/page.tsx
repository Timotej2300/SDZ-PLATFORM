import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/auth'
import { Badge, PageHeader, statusTone } from '@/components/ui'
import { ORG_STATUS_LABELS } from '@/lib/labels'

export const metadata = { title: 'Nastavenia organizácie' }

export default async function Page() {
  const { org, ctx } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  const supabase = await createClient()
  const { data } = await supabase.from('organizations').select('org_number,slug,status').eq('id', org.id).single()
  const mine = ctx.orgs.find((o) => o.id === org.id)
  return (
    <div className="space-y-6">
      <PageHeader title="Nastavenia organizácie" />
      <section className="card">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-600">Stav</dt><dd><Badge tone={statusTone(data?.status)}>{ORG_STATUS_LABELS[data?.status as string]}</Badge></dd></div>
          <div><dt className="text-ink-600">Organizačné číslo</dt><dd className="font-mono">{data?.org_number ?? 'zatiaľ nepridelené'}</dd></div>
          <div><dt className="text-ink-600">Verejná adresa</dt><dd>{data?.status === 'approved' ? `/organizacie/${data?.slug}` : 'po schválení'}</dd></div>
          <div><dt className="text-ink-600">Vaše roly</dt><dd>{mine?.roles.join(', ')}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-ink-600">Profil upravíte v sekcii Profil organizácie, pracovníkov v sekcii Zamestnanci a pracovníci.</p>
      </section>
    </div>
  )
}
