import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'
import { setUserBan } from '@/actions/founder'

export const metadata = { title: 'Používatelia' }

type Row = { id: string; first_name: string; last_name: string; email: string; created_at: string }

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const supabase = await createClient()
  let query = supabase.from('profiles').select('id,first_name,last_name,email,created_at').order('created_at', { ascending: false }).limit(100)
  const term = q.trim().replace(/[%,()*]/g, ' ').slice(0, 60)
  if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
  const { data } = await query
  const rows = (data ?? []) as Row[]

  const banned = new Set<string>()
  try {
    const { data: list } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of list?.users ?? []) if ((u as { banned_until?: string | null }).banned_until && new Date((u as { banned_until: string }).banned_until) > new Date()) banned.add(u.id)
  } catch {
    // bez service role kľúča sa stav blokovania nezobrazí
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Centrálna správa používateľov" intro="Zablokovaný používateľ sa nemôže prihlásiť. Účet Foundera nie je možné zablokovať." />
      <form className="flex gap-3" role="search">
        <input name="q" defaultValue={q} placeholder="Meno alebo e-mail" className="input" aria-label="Hľadať" />
        <button className="btn-primary" type="submit">Hľadať</button>
      </form>
      {rows.length === 0 ? <Empty title="Nenašli sa žiadni používatelia" /> : (
        <Table head={['Meno', 'E-mail', 'Registrovaný', 'Stav', '']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.first_name} {r.last_name}</Td>
              <Td>{r.email}</Td>
              <Td>{fmtDate(r.created_at)}</Td>
              <Td>{banned.has(r.id) ? <Badge tone="red">Zablokovaný</Badge> : <Badge tone="green">Aktívny</Badge>}</Td>
              <Td>
                <ActionForm action={setUserBan} submit={banned.has(r.id) ? 'Odblokovať' : 'Zablokovať'} variant={banned.has(r.id) ? 'secondary' : 'danger'} confirm={banned.has(r.id) ? 'Odblokovať účet?' : 'Zablokovať účet? Používateľ sa nebude môcť prihlásiť.'}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="ban" value={banned.has(r.id) ? '0' : '1'} />
                </ActionForm>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
