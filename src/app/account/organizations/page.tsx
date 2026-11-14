import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, Field, PageHeader, Select, Table, Td, statusTone } from '@/components/ui'
import { GUESTING_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { cancelGuesting, requestGuesting } from '@/actions/account'

export const metadata = { title: 'Domovská organizácia' }

type Mem = { id: string; status: string; started_at: string; ended_at: string | null; organizations: { name: string; slug: string } | null }
type Gst = { id: string; host_org_name: string; starts_on: string; ends_on: string; status: string; rejection_reason: string | null }

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) {
    return (
      <div>
        <PageHeader title="Domovská organizácia" />
        <Empty title="Zatiaľ nie ste členom žiadnej organizácie" hint="Členstvo vznikne po schválení vašej registrácie." />
      </div>
    )
  }
  const supabase = await createClient()
  const [{ data: mems }, { data: gsts }, { data: orgs }, { data: vol }] = await Promise.all([
    supabase.from('organization_memberships').select('id,status,started_at,ended_at,organizations(name,slug)').eq('volunteer_id', ctx.volunteer_id).order('started_at', { ascending: false }),
    supabase.from('volunteer_guestings').select('id,host_org_name,starts_on,ends_on,status,rejection_reason').eq('volunteer_id', ctx.volunteer_id).order('created_at', { ascending: false }),
    supabase.from('public_organizations').select('id,name').order('name'),
    supabase.from('volunteers').select('home_organization_id').eq('id', ctx.volunteer_id).single(),
  ])
  const memberships = (mems ?? []) as unknown as Mem[]
  const guestings = (gsts ?? []) as Gst[]
  const home = vol?.home_organization_id as string | null
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader title="Domovská organizácia" intro="Máte maximálne jedno aktívne členstvo. Hosťovanie ani účasť na podujatí inej organizácie druhé členstvo nevytvára." />
      <section>
        <h2 className="mb-2 font-semibold">Členstvá</h2>
        <Table head={['Organizácia', 'Od', 'Do', 'Stav']}>
          {memberships.map((m) => (
            <tr key={m.id}>
              <Td>{m.organizations?.name}</Td>
              <Td>{fmtDate(m.started_at)}</Td>
              <Td>{fmtDate(m.ended_at)}</Td>
              <Td>{m.status === 'active' ? <Badge tone="green">Aktívne</Badge> : <Badge>Ukončené</Badge>}</Td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Hosťovania</h2>
        {guestings.length === 0 ? (
          <Empty title="Žiadne hosťovania" />
        ) : (
          <Table head={['Hosťujúca organizácia', 'Od', 'Do', 'Stav', '']}>
            {guestings.map((g) => (
              <tr key={g.id}>
                <Td>{g.host_org_name}</Td>
                <Td>{fmtDate(g.starts_on)}</Td>
                <Td>{fmtDate(g.ends_on)}</Td>
                <Td>
                  <Badge tone={statusTone(g.status)}>{GUESTING_STATUS_LABELS[g.status]}</Badge>
                  {g.rejection_reason && <p className="mt-1 text-xs">Dôvod: {g.rejection_reason}</p>}
                </Td>
                <Td>
                  {['pending_home', 'pending_host', 'active'].includes(g.status) && (
                    <ActionForm action={cancelGuesting} submit="Zrušiť" variant="secondary" confirm="Zrušiť hosťovanie?">
                      <input type="hidden" name="id" value={g.id} />
                    </ActionForm>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {home && (
        <section className="card">
          <h2 className="font-semibold">Požiadať o hosťovanie</h2>
          <p className="mt-1 text-sm text-ink-600">Najprv musí súhlasiť domovská organizácia, potom hosťujúca. Vyžaduje sa platná licencia.</p>
          <ActionForm action={requestGuesting} submit="Odoslať žiadosť" className="mt-3 max-w-lg">
            <Select label="Hosťujúca organizácia" name="organization" required placeholder="Vyberte organizáciu"
              options={((orgs ?? []) as { id: string; name: string }[]).filter((o) => o.id !== home).map((o) => ({ value: o.id, label: o.name }))} />
            <Field label="Od" name="start" type="date" required defaultValue={today} />
            <Field label="Do" name="end" type="date" required defaultValue={today} />
          </ActionForm>
        </section>
      )}
    </div>
  )
}
