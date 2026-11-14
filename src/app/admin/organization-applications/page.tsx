import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { DecisionForm } from '@/components/DecisionForm'
import { Badge, Empty, PageHeader, statusTone } from '@/components/ui'
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS, fmtDate } from '@/lib/labels'
import { reviewOrganization } from '@/actions/admin'

export const metadata = { title: 'Žiadosti organizácií' }

type Org = {
  id: string; name: string; type: string; status: string; address: string | null; ico: string | null
  contact_email: string | null; description: string | null; created_at: string; regions: { name: string } | null
  organization_documents: { id: string; file_name: string; storage_path: string }[]
  profiles: { first_name: string; last_name: string; email: string; birth_year: number | null } | null
}

export default async function Page() {
  await requirePermission('orgs.review', '/admin/organization-applications')
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('id,name,type,status,address,ico,contact_email,description,created_at,regions(name),organization_documents(id,file_name,storage_path),profiles!organizations_created_by_fkey(first_name,last_name,email,birth_year)')
    .in('status', ['submitted', 'in_review', 'needs_info'])
    .order('created_at')
  const orgs = (data ?? []) as unknown as Org[]
  const urls = new Map<string, string>()
  await Promise.all(orgs.flatMap((o) => o.organization_documents).map(async (d) => {
    const { data: s } = await supabase.storage.from('org-documents').createSignedUrl(d.storage_path, 300, { download: d.file_name })
    if (s?.signedUrl) urls.set(d.id, s.signedUrl)
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="Žiadosti organizácií" intro="Schváliť, zamietnuť alebo vrátiť na doplnenie. Zamietnutie a vrátenie vyžadujú dôvod." />
      {orgs.length === 0 ? <Empty title="Žiadne čakajúce žiadosti" /> : orgs.map((o) => {
        const choices = [
          ...(o.status === 'submitted' ? [{ value: 'start_review', label: 'Začať kontrolu', variant: 'secondary' as const }] : []),
          { value: 'approve', label: 'Schváliť', variant: 'success' as const },
          { value: 'request_info', label: 'Vrátiť na doplnenie', variant: 'secondary' as const, needsReason: true },
          { value: 'reject', label: 'Zamietnuť', variant: 'danger' as const, needsReason: true },
        ]
        const age = o.profiles?.birth_year ? new Date().getFullYear() - o.profiles.birth_year : null
        return (
          <section key={o.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{o.name}</h2>
              <Badge tone={statusTone(o.status)}>{ORG_STATUS_LABELS[o.status]}</Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-600">Typ</dt><dd>{ORG_TYPE_LABELS[o.type]}</dd></div>
              <div><dt className="text-ink-600">Kraj</dt><dd>{o.regions?.name ?? '—'}</dd></div>
              <div><dt className="text-ink-600">Adresa</dt><dd>{o.address ?? '—'}</dd></div>
              <div><dt className="text-ink-600">IČO</dt><dd>{o.ico ?? '—'}</dd></div>
              <div><dt className="text-ink-600">Kontakt</dt><dd>{o.contact_email ?? '—'}</dd></div>
              <div><dt className="text-ink-600">Koordinátor</dt><dd>{o.profiles?.first_name} {o.profiles?.last_name} ({o.profiles?.email}){age !== null ? `, vek približne ${age}` : ''}</dd></div>
              <div><dt className="text-ink-600">Vytvorená</dt><dd>{fmtDate(o.created_at)}</dd></div>
            </dl>
            {o.description && <p className="mt-3 whitespace-pre-line text-sm">{o.description}</p>}
            <p className="mt-3 text-sm font-semibold">Dokumenty</p>
            <ul className="text-sm">
              {o.organization_documents.length === 0 ? <li className="text-ink-600">Žiadne</li> : o.organization_documents.map((d) => (
                <li key={d.id}>{urls.get(d.id) ? <a href={urls.get(d.id)} className="text-navy-700 underline">{d.file_name}</a> : d.file_name}</li>
              ))}
            </ul>
            <div className="mt-4"><DecisionForm action={reviewOrganization} id={o.id} choices={choices} /></div>
          </section>
        )
      })}
    </div>
  )
}
