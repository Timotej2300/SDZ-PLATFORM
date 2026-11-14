import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'

export const metadata = { title: 'Používatelia' }

type Row = { id: string; first_name: string; last_name: string; email: string; created_at: string }

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission('users.read', '/admin/users')
  const { q = '' } = await searchParams
  const supabase = await createClient()
  let query = supabase.from('profiles').select('id,first_name,last_name,email,created_at').order('created_at', { ascending: false }).limit(200)
  const term = q.trim().replace(/[%,()*]/g, ' ').slice(0, 60)
  if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
  const { data } = await query
  const rows = (data ?? []) as Row[]
  return (
    <div className="space-y-6">
      <PageHeader title="Používatelia" intro="Blokovanie účtov a správu administrátorov vykonáva Founder vo Founder Control Center." />
      <form className="flex gap-3" role="search">
        <input name="q" defaultValue={q} placeholder="Meno alebo e-mail" className="input" aria-label="Hľadať" />
        <button className="btn-primary" type="submit">Hľadať</button>
      </form>
      {rows.length === 0 ? <Empty title="Nenašli sa žiadni používatelia" /> : (
        <Table head={['Meno', 'E-mail', 'Registrovaný']}>
          {rows.map((r) => (
            <tr key={r.id}><Td>{r.first_name} {r.last_name}</Td><Td>{r.email}</Td><Td>{fmtDate(r.created_at)}</Td></tr>
          ))}
        </Table>
      )}
    </div>
  )
}
