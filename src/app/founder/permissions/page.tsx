import { createClient } from '@/lib/supabase/server'
import { Badge, PageHeader, Table, Td } from '@/components/ui'
import { SCOPE_LABELS } from '@/lib/labels'

export const metadata = { title: 'Oprávnenia' }

export default async function Page() {
  const supabase = await createClient()
  const [{ data }, { data: rp }, { data: roles }] = await Promise.all([
    supabase.from('permissions').select('key,description,scope').order('scope').order('key'),
    supabase.from('role_permissions').select('role_id,permission_key'),
    supabase.from('roles').select('id,name'),
  ])
  const names = new Map(((roles ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]))
  const byPerm = new Map<string, string[]>()
  for (const x of (rp ?? []) as { role_id: string; permission_key: string }[]) {
    byPerm.set(x.permission_key, [...(byPerm.get(x.permission_key) ?? []), names.get(x.role_id) ?? '?'])
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Oprávnenia" intro="Katalóg oprávnení, ktoré kontroluje server aj databáza. Priradenie oprávnení rolám sa nastavuje v sekcii Roly." />
      <Table head={['Kľúč', 'Rozsah', 'Popis', 'Roly']}>
        {((data ?? []) as { key: string; description: string; scope: string }[]).map((p) => (
          <tr key={p.key}>
            <Td className="font-mono text-xs">{p.key}</Td>
            <Td><Badge>{SCOPE_LABELS[p.scope]}</Badge></Td>
            <Td>{p.description}</Td>
            <Td className="text-xs">{(byPerm.get(p.key) ?? []).join(', ') || '—'}</Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
