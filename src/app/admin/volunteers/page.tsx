import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { Badge, Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'

export const metadata = { title: 'Register dobrovoľníkov' }

type Row = {
  id: string; registration_number: string; status: string; created_at: string
  profiles: { first_name: string; last_name: string; email: string } | null
  organizations: { name: string } | null
}

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission('volunteers.read.all', '/admin/volunteers')
  const { q = '' } = await searchParams
  const supabase = await createClient()
  let query = supabase
    .from('volunteers')
    .select('id,registration_number,status,created_at,profiles!inner(first_name,last_name,email),organizations:home_organization_id(name)')
    .order('created_at', { ascending: false })
    .limit(200)
  const term = q.trim().replace(/[%,()*]/g, ' ').slice(0, 60)
  if (term) {
    query = /^SDZ-/i.test(term)
      ? query.ilike('registration_number', `%${term}%`)
      : query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`, { referencedTable: 'profiles' })
  }
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]
  return (
    <div className="space-y-6">
      <PageHeader title="Centrálny register dobrovoľníkov" />
      <form className="flex gap-3" role="search">
        <input name="q" defaultValue={q} placeholder="Meno, e-mail alebo registračné číslo" className="input" aria-label="Hľadať" />
        <button className="btn-primary" type="submit">Hľadať</button>
      </form>
      {rows.length === 0 ? <Empty title="Nenašli sa žiadni dobrovoľníci" /> : (
        <Table head={['Meno', 'E-mail', 'Registračné číslo', 'Domovská organizácia', 'Od', 'Stav']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.profiles?.first_name} {r.profiles?.last_name}</Td>
              <Td>{r.profiles?.email}</Td>
              <Td className="font-mono">{r.registration_number}</Td>
              <Td>{r.organizations?.name ?? '—'}</Td>
              <Td>{fmtDate(r.created_at)}</Td>
              <Td>{r.status === 'active' ? <Badge tone="green">Aktívny</Badge> : <Badge tone="amber">{r.status}</Badge>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
