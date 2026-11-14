import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { DecisionForm } from '@/components/DecisionForm'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { GUESTING_STATUS_LABELS, TRANSFER_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { decideGuesting, decideTransfer } from '@/actions/org'

export const metadata = { title: 'Prestupy a hosťovania' }

type Tr = {
  id: string; status: string; from_org_id: string; to_org_id: string; from_org_name: string; to_org_name: string
  requested_at: string; origin_due_at: string; target_due_at: string | null; overdue_from: string | null
  volunteers: { registration_number: string; profiles: { first_name: string; last_name: string } | null } | null
}
type Gst = {
  id: string; status: string; home_org_id: string; host_org_id: string; home_org_name: string; host_org_name: string
  starts_on: string; ends_on: string
  volunteers: { registration_number: string; profiles: { first_name: string; last_name: string } | null } | null
}

const choices = [
  { value: 'approve', label: 'Schváliť', variant: 'success' as const },
  { value: 'reject', label: 'Zamietnuť', variant: 'danger' as const, needsReason: true },
]

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('transfers.decide', org.id))) redirect('/organization')
  const supabase = await createClient()
  const [{ data: trs }, { data: gsts }] = await Promise.all([
    supabase.from('volunteer_transfers')
      .select('id,status,from_org_id,to_org_id,from_org_name,to_org_name,requested_at,origin_due_at,target_due_at,overdue_from,volunteers(registration_number,profiles(first_name,last_name))')
      .or(`from_org_id.eq.${org.id},to_org_id.eq.${org.id}`).order('requested_at', { ascending: false }).limit(100),
    supabase.from('volunteer_guestings')
      .select('id,status,home_org_id,host_org_id,home_org_name,host_org_name,starts_on,ends_on,volunteers(registration_number,profiles(first_name,last_name))')
      .or(`home_org_id.eq.${org.id},host_org_id.eq.${org.id}`).order('created_at', { ascending: false }).limit(100),
  ])
  const transfers = (trs ?? []) as unknown as Tr[]
  const guestings = (gsts ?? []) as unknown as Gst[]
  const myTurnT = (t: Tr) =>
    (t.from_org_id === org.id && (t.status === 'pending_origin' || (t.status === 'overdue_review' && t.overdue_from === 'origin'))) ||
    (t.to_org_id === org.id && (t.status === 'pending_target' || (t.status === 'overdue_review' && t.overdue_from === 'target')))
  const myTurnG = (g: Gst) =>
    (g.status === 'pending_home' && g.home_org_id === org.id) || (g.status === 'pending_host' && g.host_org_id === org.id)
  const name = (v: Tr['volunteers']) => `${v?.profiles?.first_name ?? ''} ${v?.profiles?.last_name ?? ''}`

  return (
    <div className="space-y-8">
      <PageHeader title="Prestupy a hosťovania" intro="Každá organizácia rozhoduje do 30 kalendárnych dní od prijatia žiadosti. Po lehote sa prestup automaticky neschváli a nečinnosť preverí SDZ." />
      <section>
        <h2 className="mb-2 font-semibold">Prestupy</h2>
        {transfers.length === 0 ? <Empty title="Žiadne prestupy" /> : (
          <Table head={['Dobrovoľník', 'Z → Do', 'Žiadosť', 'Stav', 'Rozhodnutie']}>
            {transfers.map((t) => (
              <tr key={t.id}>
                <Td>{name(t.volunteers)}<span className="block font-mono text-xs">{t.volunteers?.registration_number}</span></Td>
                <Td>{t.from_org_name} → {t.to_org_name}</Td>
                <Td>{fmtDate(t.requested_at)}</Td>
                <Td>
                  <Badge tone={statusTone(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</Badge>
                  {t.status === 'pending_origin' && <p className="mt-1 text-xs text-ink-600">Lehota do {fmtDate(t.origin_due_at)}</p>}
                  {t.status === 'pending_target' && <p className="mt-1 text-xs text-ink-600">Lehota do {fmtDate(t.target_due_at)}</p>}
                </Td>
                <Td>{myTurnT(t) ? <DecisionForm action={decideTransfer} id={t.id} choices={choices} /> : '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Hosťovania</h2>
        {guestings.length === 0 ? <Empty title="Žiadne hosťovania" /> : (
          <Table head={['Dobrovoľník', 'Domovská → Hosťujúca', 'Obdobie', 'Stav', 'Rozhodnutie']}>
            {guestings.map((g) => (
              <tr key={g.id}>
                <Td>{name(g.volunteers)}<span className="block font-mono text-xs">{g.volunteers?.registration_number}</span></Td>
                <Td>{g.home_org_name} → {g.host_org_name}</Td>
                <Td>{fmtDate(g.starts_on)} – {fmtDate(g.ends_on)}</Td>
                <Td><Badge tone={statusTone(g.status)}>{GUESTING_STATUS_LABELS[g.status]}</Badge></Td>
                <Td>{myTurnG(g) ? <DecisionForm action={decideGuesting} id={g.id} choices={choices} /> : '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  )
}
