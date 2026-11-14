import { createClient } from '@/lib/supabase/server'
import { hasPermission, requireCentral } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, PageHeader, Select, Table, Td } from '@/components/ui'
import { addDistrict, addRegion } from '@/actions/admin'

export const metadata = { title: 'Regióny' }

export default async function Page() {
  await requireCentral('/admin/regions')
  const canManage = await hasPermission('regions.manage')
  const supabase = await createClient()
  const [{ data: regions }, { data: districts }, { data: orgs }] = await Promise.all([
    supabase.from('regions').select('id,code,name').order('name'),
    supabase.from('districts').select('id,region_id,name').order('name'),
    supabase.from('organizations').select('region_id').eq('status', 'approved'),
  ])
  const dist = (districts ?? []) as { id: string; region_id: string; name: string }[]
  const rs = (regions ?? []) as { id: string; code: string; name: string }[]
  const orgCount = new Map<string, number>()
  for (const o of (orgs ?? []) as { region_id: string | null }[]) if (o.region_id) orgCount.set(o.region_id, (orgCount.get(o.region_id) ?? 0) + 1)

  return (
    <div className="space-y-6">
      <PageHeader title="Regióny" intro="Regióny a okresy spravuje SDZ centrálne. Menovanie regionálnych manažérov a regionálna administrácia pribudnú vo fáze rozšírenia." />
      {canManage && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card">
            <h2 className="font-semibold">Pridať región</h2>
            <ActionForm action={addRegion} submit="Pridať" resetOnSuccess className="mt-3">
              <Field label="Kód" name="code" required maxLength={6} />
              <Field label="Názov" name="name" required maxLength={100} />
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="font-semibold">Pridať okres</h2>
            <ActionForm action={addDistrict} submit="Pridať" resetOnSuccess className="mt-3">
              <Select label="Región" name="region" required placeholder="Vyberte región" options={rs.map((r) => ({ value: r.id, label: r.name }))} />
              <Field label="Názov okresu" name="name" required maxLength={100} />
            </ActionForm>
          </section>
        </div>
      )}
      <Table head={['Kód', 'Región', 'Okresy', 'Schválené organizácie']}>
        {rs.map((r) => (
          <tr key={r.id}>
            <Td className="font-mono">{r.code}</Td>
            <Td>{r.name}</Td>
            <Td>{dist.filter((d) => d.region_id === r.id).length}</Td>
            <Td>{orgCount.get(r.id) ?? 0}</Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
