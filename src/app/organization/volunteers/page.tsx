import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { Badge, Empty, PageHeader, Table, Td, licenseTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, fmtDate } from '@/lib/labels'

export const metadata = { title: 'Dobrovoľníci' }

type Mem = { volunteer_id: string; volunteers: { registration_number: string; profiles: { first_name: string; last_name: string; email: string } | null } | null }
type Gst = { id: string; volunteer_id: string; starts_on: string; ends_on: string; home_org_name: string; volunteers: { registration_number: string; profiles: { first_name: string; last_name: string } | null } | null }
type Lic = { volunteer_id: string; status: string; expires_on: string; created_at: string }

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('volunteers.read', org.id))) redirect('/organization')
  const supabase = await createClient()
  const [{ data: mems }, { data: gsts }] = await Promise.all([
    supabase.from('organization_memberships').select('volunteer_id,volunteers(registration_number,profiles(first_name,last_name,email))').eq('organization_id', org.id).eq('status', 'active').limit(500),
    supabase.from('volunteer_guestings').select('id,volunteer_id,starts_on,ends_on,home_org_name,volunteers(registration_number,profiles(first_name,last_name))').eq('host_org_id', org.id).eq('status', 'active'),
  ])
  const members = (mems ?? []) as unknown as Mem[]
  const guests = (gsts ?? []) as unknown as Gst[]
  const ids = [...new Set([...members.map((m) => m.volunteer_id), ...guests.map((g) => g.volunteer_id)])]
  const { data: lics } = ids.length
    ? await supabase.from('volunteer_licenses').select('volunteer_id,status,expires_on,created_at').in('volunteer_id', ids).order('created_at', { ascending: false })
    : { data: [] }
  const latest = new Map<string, Lic>()
  for (const l of (lics ?? []) as Lic[]) if (!latest.has(l.volunteer_id)) latest.set(l.volunteer_id, l)
  const eff = (l?: Lic) => (!l ? null : ['active', 'expiring'].includes(l.status) && new Date(l.expires_on) < new Date() ? 'expired' : l.status)
  const LicCell = ({ id }: { id: string }) => {
    const l = latest.get(id)
    const s = eff(l)
    return s ? <><Badge tone={licenseTone(s)}>{LICENSE_STATUS_LABELS[s]}</Badge><span className="ml-2 text-xs text-ink-600">do {fmtDate(l!.expires_on)}</span></> : <>—</>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dobrovoľníci" intro="Aktívni členovia a hosťujúci dobrovoľníci s ich licenciou." />
      <section>
        <h2 className="mb-2 font-semibold">Členovia ({members.length})</h2>
        {members.length === 0 ? <Empty title="Žiadni aktívni členovia" /> : (
          <Table head={['Meno', 'E-mail', 'Registračné číslo', 'Licencia']}>
            {members.map((m) => (
              <tr key={m.volunteer_id}>
                <Td>{m.volunteers?.profiles?.first_name} {m.volunteers?.profiles?.last_name}</Td>
                <Td>{m.volunteers?.profiles?.email}</Td>
                <Td className="font-mono">{m.volunteers?.registration_number}</Td>
                <Td><LicCell id={m.volunteer_id} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Hosťujúci dobrovoľníci ({guests.length})</h2>
        {guests.length === 0 ? <Empty title="Žiadni hosťujúci dobrovoľníci" /> : (
          <Table head={['Meno', 'Domovská organizácia', 'Hosťovanie', 'Licencia']}>
            {guests.map((g) => (
              <tr key={g.id}>
                <Td>{g.volunteers?.profiles?.first_name} {g.volunteers?.profiles?.last_name}<span className="block font-mono text-xs">{g.volunteers?.registration_number}</span></Td>
                <Td>{g.home_org_name}</Td>
                <Td>{fmtDate(g.starts_on)} – {fmtDate(g.ends_on)}</Td>
                <Td><LicCell id={g.volunteer_id} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  )
}
