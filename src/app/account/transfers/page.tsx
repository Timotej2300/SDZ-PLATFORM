import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, PageHeader, Select, Table, Td, statusTone } from '@/components/ui'
import { TRANSFER_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { cancelTransfer, requestTransfer } from '@/actions/account'

export const metadata = { title: 'Prestupy' }

type Tr = {
  id: string; status: string; from_org_name: string; to_org_name: string; requested_at: string
  origin_due_at: string; target_due_at: string | null; rejection_reason: string | null
}

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) {
    return (
      <div>
        <PageHeader title="Prestupy" />
        <Empty title="Prestup nie je dostupný" hint="Prestup môžete požiadať po schválení registrácie a vzniku členstva." />
      </div>
    )
  }
  const supabase = await createClient()
  const [{ data }, { data: orgs }, { data: vol }] = await Promise.all([
    supabase.from('volunteer_transfers').select('id,status,from_org_name,to_org_name,requested_at,origin_due_at,target_due_at,rejection_reason').eq('volunteer_id', ctx.volunteer_id).order('requested_at', { ascending: false }),
    supabase.from('public_organizations').select('id,name').order('name'),
    supabase.from('volunteers').select('home_organization_id').eq('id', ctx.volunteer_id).single(),
  ])
  const transfers = (data ?? []) as Tr[]
  const open = transfers.some((t) => ['pending_origin', 'pending_target', 'overdue_review'].includes(t.status))
  const home = vol?.home_organization_id as string | null

  return (
    <div className="space-y-6">
      <PageHeader title="Prestupy" intro="Prestup musia schváliť pôvodná aj cieľová organizácia, každá do 30 kalendárnych dní. Ak organizácia neodpovie, prestup sa automaticky neschváli a ostávate v pôvodnej organizácii; nečinnosť preverí SDZ." />
      {!open && home && (
        <section className="card">
          <h2 className="font-semibold">Požiadať o prestup</h2>
          <ActionForm action={requestTransfer} submit="Odoslať žiadosť" confirm="Odoslať žiadosť o prestup pôvodnej organizácii?" className="mt-3 max-w-lg">
            <Select label="Nová organizácia" name="organization" required placeholder="Vyberte organizáciu"
              options={((orgs ?? []) as { id: string; name: string }[]).filter((o) => o.id !== home).map((o) => ({ value: o.id, label: o.name }))} />
          </ActionForm>
        </section>
      )}
      {transfers.length === 0 ? (
        <Empty title="Zatiaľ nemáte žiadne prestupy" />
      ) : (
        <Table head={['Z', 'Do', 'Žiadosť', 'Stav', '']}>
          {transfers.map((t) => (
            <tr key={t.id}>
              <Td>{t.from_org_name}</Td>
              <Td>{t.to_org_name}</Td>
              <Td>{fmtDate(t.requested_at)}</Td>
              <Td>
                <Badge tone={statusTone(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</Badge>
                {t.status === 'pending_origin' && <p className="mt-1 text-xs text-ink-600">Lehota do {fmtDate(t.origin_due_at)}</p>}
                {t.status === 'pending_target' && <p className="mt-1 text-xs text-ink-600">Lehota do {fmtDate(t.target_due_at)}</p>}
                {t.rejection_reason && <p className="mt-1 text-xs">Dôvod: {t.rejection_reason}</p>}
              </Td>
              <Td>
                {['pending_origin', 'pending_target', 'overdue_review'].includes(t.status) && (
                  <ActionForm action={cancelTransfer} submit="Stiahnuť žiadosť" variant="secondary" confirm="Stiahnuť žiadosť o prestup?">
                    <input type="hidden" name="id" value={t.id} />
                  </ActionForm>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
