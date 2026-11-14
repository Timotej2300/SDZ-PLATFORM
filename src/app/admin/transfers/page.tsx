import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, requireCentral } from '@/lib/auth'
import { DecisionForm } from '@/components/DecisionForm'
import { Badge, Empty, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { TRANSFER_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { requestTransferStatement } from '@/actions/admin'

export const metadata = { title: 'Prestupy' }

type Tr = {
  id: string; status: string; from_org_name: string; to_org_name: string; requested_at: string
  overdue_from: string | null; overdue_at: string | null; sdz_review_requested_at: string | null; sdz_note: string | null
  volunteers: { registration_number: string; profiles: { first_name: string; last_name: string } | null } | null
}

export default async function Page() {
  await requireCentral('/admin/transfers')
  const canReview = await hasPermission('transfers.review')
  if (!canReview && !(await hasPermission('volunteers.read.all'))) redirect('/admin')
  const supabase = await createClient()
  const { data } = await supabase
    .from('volunteer_transfers')
    .select('id,status,from_org_name,to_org_name,requested_at,overdue_from,overdue_at,sdz_review_requested_at,sdz_note,volunteers(registration_number,profiles(first_name,last_name))')
    .order('requested_at', { ascending: false })
    .limit(200)
  const all = (data ?? []) as unknown as Tr[]
  const overdue = all.filter((t) => t.status === 'overdue_review')
  const rest = all.filter((t) => t.status !== 'overdue_review')
  const nm = (t: Tr) => `${t.volunteers?.profiles?.first_name ?? ''} ${t.volunteers?.profiles?.last_name ?? ''}`

  return (
    <div className="space-y-8">
      <PageHeader title="Prestupy" intro="Prestup po 30 dňoch bez odpovede sa automaticky neschváli. SDZ môže preveriť nečinnosť a vyžiadať stanovisko organizácie; zásah sa zapisuje do auditu. Právomoc SDZ nahradiť súhlas organizácie zatiaľ nie je definovaná." />
      <section>
        <h2 className="mb-2 font-semibold">Po lehote – na preverenie ({overdue.length})</h2>
        {overdue.length === 0 ? <Empty title="Žiadne prestupy po lehote" /> : (
          <Table head={['Dobrovoľník', 'Z → Do', 'Nečinná organizácia', 'Stanovisko', 'Akcia']}>
            {overdue.map((t) => (
              <tr key={t.id}>
                <Td>{nm(t)}<span className="block font-mono text-xs">{t.volunteers?.registration_number}</span></Td>
                <Td>{t.from_org_name} → {t.to_org_name}</Td>
                <Td>{t.overdue_from === 'origin' ? t.from_org_name : t.to_org_name}<span className="block text-xs text-ink-600">od {fmtDate(t.overdue_at)}</span></Td>
                <Td>{t.sdz_review_requested_at ? <>Vyžiadané {fmtDate(t.sdz_review_requested_at)}<span className="block text-xs">{t.sdz_note}</span></> : '—'}</Td>
                <Td>{canReview && <DecisionForm action={requestTransferStatement} id={t.id} reasonLabel="Aké stanovisko vyžadujete" choices={[{ value: 'request', label: 'Vyžiadať stanovisko', variant: 'primary', needsReason: true }]} />}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Ostatné prestupy</h2>
        {rest.length === 0 ? <Empty title="Žiadne prestupy" /> : (
          <Table head={['Dobrovoľník', 'Z → Do', 'Žiadosť', 'Stav']}>
            {rest.map((t) => (
              <tr key={t.id}>
                <Td>{nm(t)}<span className="block font-mono text-xs">{t.volunteers?.registration_number}</span></Td>
                <Td>{t.from_org_name} → {t.to_org_name}</Td>
                <Td>{fmtDate(t.requested_at)}</Td>
                <Td><Badge tone={statusTone(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</Badge></Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  )
}
