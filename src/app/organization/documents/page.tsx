import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Empty, PageHeader, Select, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'
import { deleteOrgDocument, uploadOrgDocument } from '@/actions/org'

export const metadata = { title: 'Dokumenty' }

const KINDS: Record<string, string> = { registration: 'Doklad o registrácii', statute: 'Stanovy', identity: 'Doklad totožnosti štatutára', other: 'Iný dokument' }
type Doc = { id: string; kind: string; file_name: string; storage_path: string; size_bytes: number; created_at: string }

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('org.documents', org.id))) redirect('/organization')
  const supabase = await createClient()
  const [{ data }, { data: o }] = await Promise.all([
    supabase.from('organization_documents').select('id,kind,file_name,storage_path,size_bytes,created_at').eq('organization_id', org.id).order('created_at', { ascending: false }),
    supabase.from('organizations').select('status').eq('id', org.id).single(),
  ])
  const docs = (data ?? []) as Doc[]
  const links = await Promise.all(docs.map(async (d) => (await supabase.storage.from('org-documents').createSignedUrl(d.storage_path, 120, { download: d.file_name })).data?.signedUrl ?? null))
  const status = o?.status as string
  const canUpload = ['draft', 'needs_info', 'approved'].includes(status)
  const canDelete = ['draft', 'needs_info'].includes(status)

  return (
    <div className="space-y-6">
      <PageHeader title="Dokumenty" intro="Dokumenty sú privátne – vidí ich iba štáb organizácie s oprávnením a SDZ. Povolené sú PDF, JPG a PNG do 10 MB." />
      {canUpload && (
        <section className="card">
          <ActionForm action={uploadOrgDocument} submit="Nahrať dokument" className="max-w-lg" resetOnSuccess>
            <input type="hidden" name="id" value={org.id} />
            <Select label="Typ dokumentu" name="kind" required placeholder="Vyberte typ" options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} />
            <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png" className="input pt-2" aria-label="Súbor" />
          </ActionForm>
        </section>
      )}
      {docs.length === 0 ? (
        <Empty title="Zatiaľ ste nenahrali žiadny dokument" />
      ) : (
        <Table head={['Súbor', 'Typ', 'Veľkosť', 'Nahrané', '']}>
          {docs.map((d, i) => (
            <tr key={d.id}>
              <Td>{links[i] ? <a href={links[i]!} className="font-semibold text-navy-700 underline">{d.file_name}</a> : d.file_name}</Td>
              <Td>{KINDS[d.kind]}</Td>
              <Td>{Math.max(1, Math.round(d.size_bytes / 1024))} kB</Td>
              <Td>{fmtDate(d.created_at)}</Td>
              <Td>
                {canDelete && (
                  <ActionForm action={deleteOrgDocument} submit="Odstrániť" variant="secondary" confirm="Odstrániť dokument?">
                    <input type="hidden" name="id" value={d.id} />
                  </ActionForm>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
