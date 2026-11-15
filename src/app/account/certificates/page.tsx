import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { Badge, Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'

export const metadata = { title: 'Certifikáty' }

type C = { id: string; certificate_number: string; title: string; hours: number; issued_at: string; revoked_at: string | null; revoke_reason: string | null }

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) return <div><PageHeader title="Certifikáty" /><Empty title="Certifikáty sú dostupné po registrácii dobrovoľníka" /></div>
  const supabase = await createClient()
  const { data } = await supabase.from('volunteer_certificates').select('id,certificate_number,title,hours,issued_at,revoked_at,revoke_reason')
    .eq('volunteer_id', ctx.volunteer_id).order('issued_at', { ascending: false })
  const rows = (data ?? []) as C[]
  return (
    <div className="space-y-6">
      <PageHeader title="Certifikáty" intro="Potvrdenia o dobrovoľníckej činnosti vystavené organizátormi podujatí." />
      {rows.length === 0 ? <Empty title="Zatiaľ nemáte žiadny certifikát" hint="Organizátor ho môže vystaviť po skončení podujatia, ak máte zapísané odpracované hodiny." /> : (
        <Table head={['Číslo', 'Názov', 'Hodiny', 'Vystavený', 'Stav']}>
          {rows.map((c) => (
            <tr key={c.id}>
              <Td className="font-mono">{c.certificate_number}</Td>
              <Td>{c.title}</Td>
              <Td>{Number(c.hours).toFixed(2)}</Td>
              <Td>{fmtDate(c.issued_at)}</Td>
              <Td>{c.revoked_at ? <Badge tone="red">Zrušený{c.revoke_reason ? `: ${c.revoke_reason}` : ''}</Badge> : <Badge tone="green">Platný</Badge>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
