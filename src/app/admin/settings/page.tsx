import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PageHeader, Table, Td } from '@/components/ui'

export const metadata = { title: 'Centrálne nastavenia' }

export default async function Page() {
  await requirePermission('settings.write', '/admin/settings')
  const supabase = await createClient()
  const { data } = await supabase.from('system_settings').select('key,value,description').order('key')
  return (
    <div className="space-y-6">
      <PageHeader title="Centrálne nastavenia" intro="Globálne nastavenia mení iba Founder." />
      <Table head={['Kľúč', 'Hodnota', 'Popis']}>
        {((data ?? []) as { key: string; value: unknown; description: string | null }[]).map((s) => (
          <tr key={s.key}><Td className="font-mono">{s.key}</Td><Td className="font-mono">{JSON.stringify(s.value)}</Td><Td>{s.description}</Td></tr>
        ))}
      </Table>
    </div>
  )
}
