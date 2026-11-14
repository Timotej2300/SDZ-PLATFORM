import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { DecisionForm } from '@/components/DecisionForm'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { REG_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { reviewRegistration } from '@/actions/admin'

export const metadata = { title: 'Registrácie dobrovoľníkov' }

type Reg = {
  id: string; status: string; submitted_at: string; note: string | null
  profiles: { first_name: string; last_name: string; email: string; birth_year: number | null } | null
  organizations: { name: string } | null
}

export default async function Page() {
  await requirePermission('volunteers.review', '/admin/registrations')
  const supabase = await createClient()
  const { data } = await supabase
    .from('volunteer_registrations')
    .select('id,status,submitted_at,note,profiles(first_name,last_name,email,birth_year),organizations(name)')
    .order('submitted_at', { ascending: false })
    .limit(200)
  const regs = (data ?? []) as unknown as Reg[]
  const open = regs.filter((r) => ['submitted', 'in_review'].includes(r.status))
  const rest = regs.filter((r) => !['submitted', 'in_review'].includes(r.status))

  return (
    <div className="space-y-6">
      <PageHeader title="Registrácie dobrovoľníkov" intro="Po schválení vznikne dobrovoľníkovi registračné číslo, členstvo v pozývajúcej organizácii a prvá licencia. E-mail musí byť overený; registrácia maloletých zatiaľ nie je podporovaná." />
      <section>
        <h2 className="mb-2 font-semibold">Na rozhodnutie ({open.length})</h2>
        {open.length === 0 ? <Empty title="Žiadne čakajúce registrácie" /> : (
          <Table head={['Dobrovoľník', 'Organizácia', 'Odoslaná', 'Rozhodnutie']}>
            {open.map((r) => (
              <tr key={r.id}>
                <Td>{r.profiles?.first_name} {r.profiles?.last_name}<span className="block text-xs text-ink-600">{r.profiles?.email} · nar. {r.profiles?.birth_year ?? '—'}</span></Td>
                <Td>{r.organizations?.name}</Td>
                <Td>{fmtDate(r.submitted_at)}<span className="block"><Badge tone={statusTone(r.status)}>{REG_STATUS_LABELS[r.status]}</Badge></span></Td>
                <Td>
                  <DecisionForm action={reviewRegistration} id={r.id} choices={[
                    { value: 'approve', label: 'Schváliť', variant: 'success' },
                    { value: 'request_info', label: 'Vrátiť na doplnenie', variant: 'secondary', needsReason: true },
                    { value: 'reject', label: 'Zamietnuť', variant: 'danger', needsReason: true },
                  ]} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {rest.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Vybavené</h2>
          <Table head={['Dobrovoľník', 'Organizácia', 'Odoslaná', 'Stav']}>
            {rest.map((r) => (
              <tr key={r.id}>
                <Td>{r.profiles?.first_name} {r.profiles?.last_name}</Td>
                <Td>{r.organizations?.name}</Td>
                <Td>{fmtDate(r.submitted_at)}</Td>
                <Td><Badge tone={statusTone(r.status)}>{REG_STATUS_LABELS[r.status]}</Badge>{r.note && <p className="mt-1 text-xs">{r.note}</p>}</Td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </div>
  )
}
