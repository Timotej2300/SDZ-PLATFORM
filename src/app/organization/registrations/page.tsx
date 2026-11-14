import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, Field, PageHeader, Table, Td, statusTone } from '@/components/ui'
import { REG_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { inviteVolunteer } from '@/actions/org'

export const metadata = { title: 'Žiadosti o registráciu' }

type Reg = { id: string; status: string; submitted_at: string; note: string | null; profiles: { first_name: string; last_name: string; email: string } | null }
type Inv = { id: string; email: string; created_at: string; expires_at: string; used_at: string | null }

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('volunteers.invite', org.id))) redirect('/organization')
  const supabase = await createClient()
  const [{ data: regs }, { data: invs }] = await Promise.all([
    supabase.from('volunteer_registrations').select('id,status,submitted_at,note,profiles(first_name,last_name,email)').eq('organization_id', org.id).order('submitted_at', { ascending: false }).limit(200),
    supabase.from('organization_invitations').select('id,email,created_at,expires_at,used_at').eq('organization_id', org.id).is('used_at', null).order('created_at', { ascending: false }).limit(100),
  ])
  const registrations = (regs ?? []) as unknown as Reg[]
  const invitations = (invs ?? []) as Inv[]
  const approved = org.status === 'approved'

  return (
    <div className="space-y-6">
      <PageHeader title="Žiadosti o registráciu" intro="Registráciu dobrovoľníka iniciuje organizácia pozvánkou. Pozvaný dokončí registráciu, overí e-mail a registráciu následne kontroluje SDZ." />
      {approved ? (
        <section className="card">
          <h2 className="font-semibold">Pozvať dobrovoľníka</h2>
          <ActionForm action={inviteVolunteer} submit="Vytvoriť pozvánku" className="mt-3 max-w-lg" resetOnSuccess>
            <input type="hidden" name="org" value={org.id} />
            <Field label="E-mail dobrovoľníka" name="email" type="email" required />
          </ActionForm>
        </section>
      ) : (
        <p className="card">Pozvánky je možné vytvárať až po schválení organizácie.</p>
      )}
      <section>
        <h2 className="mb-2 font-semibold">Čakajúce pozvánky</h2>
        {invitations.length === 0 ? <Empty title="Žiadne nepoužité pozvánky" /> : (
          <Table head={['E-mail', 'Vytvorená', 'Platí do', 'Stav']}>
            {invitations.map((i) => (
              <tr key={i.id}>
                <Td>{i.email}</Td>
                <Td>{fmtDate(i.created_at)}</Td>
                <Td>{fmtDate(i.expires_at)}</Td>
                <Td>{new Date(i.expires_at) < new Date() ? <Badge tone="red">Expirovaná</Badge> : <Badge tone="blue">Čaká</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Registrácie</h2>
        {registrations.length === 0 ? <Empty title="Zatiaľ žiadne registrácie" /> : (
          <Table head={['Meno', 'E-mail', 'Odoslaná', 'Stav']}>
            {registrations.map((r) => (
              <tr key={r.id}>
                <Td>{r.profiles?.first_name} {r.profiles?.last_name}</Td>
                <Td>{r.profiles?.email}</Td>
                <Td>{fmtDate(r.submitted_at)}</Td>
                <Td><Badge tone={statusTone(r.status)}>{REG_STATUS_LABELS[r.status]}</Badge>{r.note && <p className="mt-1 text-xs">{r.note}</p>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  )
}
