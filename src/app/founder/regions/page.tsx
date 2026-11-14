import { createClient } from '@/lib/supabase/server'
import { ActionForm } from '@/components/ActionForm'
import { Field, PageHeader, Select, Table, Td } from '@/components/ui'
import { addDistrict, addRegion } from '@/actions/admin'

export const metadata = { title: 'Regióny' }

export default async function Page() {
  const supabase = await createClient()
  const [{ data: regions }, { data: districts }] = await Promise.all([
    supabase.from('regions').select('id,code,name').order('name'),
    supabase.from('districts').select('id,region_id,name').order('name'),
  ])
  const rs = (regions ?? []) as { id: string; code: string; name: string }[]
  const ds = (districts ?? []) as { id: string; region_id: string; name: string }[]
  return (
    <div className="space-y-6">
      <PageHeader title="Centrálna správa regiónov" />
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
      <Table head={['Kód', 'Región', 'Okresy']}>
        {rs.map((r) => (
          <tr key={r.id}>
            <Td className="font-mono">{r.code}</Td>
            <Td>{r.name}</Td>
            <Td className="text-xs">{ds.filter((d) => d.region_id === r.id).map((d) => d.name).join(', ')}</Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
