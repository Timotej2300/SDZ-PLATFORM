import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRegion } from '@/lib/regional'
import { Badge, PageHeader, statusTone } from '@/components/ui'
import { StatTile } from '@/components/Stats'
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS, fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Detail organizácie' }

type D = {
  name: string; org_number: string | null; status: string; type: string; description: string | null; address: string | null
  website: string | null; contact_email: string | null; contact_phone: string | null; members: number; events: number; hours: number
  suspension: { reason: string; starts_at: string; ends_at: string | null } | null
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireRegion()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('regional_organization', { p_org: id })
  if (error || !data) notFound()
  const o = data as D
  return (
    <div className="space-y-6">
      <PageHeader title={o.name} intro={`${o.org_number ?? ''} · ${ORG_TYPE_LABELS[o.type]}`}><Badge tone={statusTone(o.status)}>{ORG_STATUS_LABELS[o.status]}</Badge></PageHeader>
      {o.suspension && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">Pozastavená od {fmtDateTime(o.suspension.starts_at)}{o.suspension.ends_at ? ` do ${fmtDateTime(o.suspension.ends_at)}` : ''}: {o.suspension.reason}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Členovia" value={o.members} /><StatTile label="Podujatia" value={o.events} /><StatTile label="Hodiny" value={Number(o.hours).toLocaleString('sk-SK')} />
      </div>
      <section className="card space-y-1 text-sm">
        {o.description && <p className="whitespace-pre-line">{o.description}</p>}
        <p>Adresa: {o.address ?? '—'}</p><p>E-mail: {o.contact_email ?? '—'} · Telefón: {o.contact_phone ?? '—'}</p><p>Web: {o.website ?? '—'}</p>
      </section>
    </div>
  )
}
