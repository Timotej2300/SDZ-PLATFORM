import { createClient } from '@/lib/supabase/server'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Field, PageHeader, Select, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'
import { grantSystemRole, revokeSystemRole } from '@/actions/founder'

export const metadata = { title: 'Administrátori' }

type Row = { id: string; granted_at: string; roles: { key: string; name: string } | null; profiles: { first_name: string; last_name: string; email: string } | null }

export default async function Page() {
  const supabase = await createClient()
  const [{ data }, { data: roles }] = await Promise.all([
    supabase.from('user_roles').select('id,granted_at,roles(key,name),profiles!user_roles_user_id_fkey(first_name,last_name,email)').eq('scope_type', 'system').is('revoked_at', null).order('granted_at'),
    supabase.from('roles').select('key,name').eq('scope', 'system').eq('is_protected', false).order('name'),
  ])
  const rows = (data ?? []) as unknown as Row[]
  return (
    <div className="space-y-6">
      <PageHeader title="Administrátorské účty" intro="Iba Founder prideľuje a odoberá centrálne roly. Rolu Founder nemožno prideliť ani odobrať z aplikácie. Používateľ musí mať zapnuté dvojfaktorové overenie, inak sa do administrácie nedostane." />
      <section className="card">
        <h2 className="font-semibold">Priradiť centrálnu rolu</h2>
        <ActionForm action={grantSystemRole} submit="Priradiť" className="mt-3 max-w-lg" resetOnSuccess>
          <Field label="E-mail existujúceho používateľa" name="email" type="email" required />
          <Select label="Rola" name="role" required placeholder="Vyberte rolu" options={((roles ?? []) as { key: string; name: string }[]).map((r) => ({ value: r.key, label: r.name }))} />
        </ActionForm>
      </section>
      <Table head={['Meno', 'E-mail', 'Rola', 'Od', '']}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td>{r.profiles?.first_name} {r.profiles?.last_name}</Td>
            <Td>{r.profiles?.email}</Td>
            <Td>{r.roles?.name} {r.roles?.key === 'founder' && <Badge tone="amber">Chránená</Badge>}</Td>
            <Td>{fmtDate(r.granted_at)}</Td>
            <Td>
              {r.roles?.key !== 'founder' && (
                <ActionForm action={revokeSystemRole} submit="Odobrať" variant="secondary" confirm="Odobrať túto rolu?">
                  <input type="hidden" name="id" value={r.id} />
                </ActionForm>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
