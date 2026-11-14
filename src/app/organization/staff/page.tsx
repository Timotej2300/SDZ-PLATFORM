import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { PageHeader, Select, Field, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'
import { grantStaffRole, revokeStaffRole } from '@/actions/org'

export const metadata = { title: 'Pracovníci organizácie' }

type Row = { id: string; granted_at: string; user_id: string; roles: { key: string; name: string } | null; profiles: { first_name: string; last_name: string; email: string } | null }

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('org.staff.manage', org.id))) redirect('/organization')
  const supabase = await createClient()
  const [{ data }, { data: roles }] = await Promise.all([
    supabase.from('user_roles').select('id,granted_at,user_id,roles(key,name),profiles!user_roles_user_id_fkey(first_name,last_name,email)').eq('scope_type', 'organization').eq('scope_id', org.id).is('revoked_at', null).order('granted_at'),
    supabase.from('roles').select('key,name').eq('scope', 'organization').order('name'),
  ])
  const rows = (data ?? []) as unknown as Row[]
  return (
    <div className="space-y-6">
      <PageHeader title="Zamestnanci a pracovníci" intro="Roly platia iba v tejto organizácii. Pracovník musí mať SDZ účet." />
      <section className="card">
        <h2 className="font-semibold">Pridať rolu</h2>
        <ActionForm action={grantStaffRole} submit="Priradiť" className="mt-3 max-w-lg" resetOnSuccess>
          <input type="hidden" name="org" value={org.id} />
          <Field label="E-mail používateľa" name="email" type="email" required />
          <Select label="Rola" name="role" required placeholder="Vyberte rolu" options={((roles ?? []) as { key: string; name: string }[]).map((r) => ({ value: r.key, label: r.name }))} />
        </ActionForm>
      </section>
      <Table head={['Meno', 'E-mail', 'Rola', 'Od', '']}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td>{r.profiles?.first_name} {r.profiles?.last_name}</Td>
            <Td>{r.profiles?.email}</Td>
            <Td>{r.roles?.name}</Td>
            <Td>{fmtDate(r.granted_at)}</Td>
            <Td>
              <ActionForm action={revokeStaffRole} submit="Odobrať" variant="secondary" confirm="Odobrať túto rolu?">
                <input type="hidden" name="id" value={r.id} />
              </ActionForm>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
