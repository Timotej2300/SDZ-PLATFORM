import { createClient } from '@/lib/supabase/server'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Field, PageHeader, Select } from '@/components/ui'
import { SCOPE_LABELS } from '@/lib/labels'
import { createRoleAction, setRolePermissionsAction } from '@/actions/founder'

export const metadata = { title: 'Roly' }

type Role = { id: string; key: string; name: string; scope: string; is_system: boolean; is_protected: boolean }
type Perm = { key: string; description: string; scope: string }

export default async function Page() {
  const supabase = await createClient()
  const [{ data: roles }, { data: perms }, { data: rp }] = await Promise.all([
    supabase.from('roles').select('id,key,name,scope,is_system,is_protected').order('scope').order('name'),
    supabase.from('permissions').select('key,description,scope').order('key'),
    supabase.from('role_permissions').select('role_id,permission_key'),
  ])
  const rs = (roles ?? []) as Role[]
  const ps = (perms ?? []) as Perm[]
  const has = new Set(((rp ?? []) as { role_id: string; permission_key: string }[]).map((x) => `${x.role_id}|${x.permission_key}`))

  return (
    <div className="space-y-6">
      <PageHeader title="Roly" intro="Roly a ich oprávnenia sa menia bez zásahu do zdrojového kódu. Rola Founder je chránená a nedá sa upraviť." />
      <section className="card">
        <h2 className="font-semibold">Nová rola</h2>
        <ActionForm action={createRoleAction} submit="Vytvoriť rolu" className="mt-3 max-w-lg" resetOnSuccess>
          <Field label="Kľúč (malé písmená a _)" name="key" required maxLength={41} />
          <Field label="Názov" name="name" required maxLength={80} />
          <Select label="Rozsah" name="scope" required options={Object.entries(SCOPE_LABELS).map(([value, label]) => ({ value, label }))} />
        </ActionForm>
      </section>
      {rs.map((r) => (
        <section key={r.id} className="card">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{r.name}</h2>
            <code className="text-xs text-ink-600">{r.key}</code>
            <Badge>{SCOPE_LABELS[r.scope]}</Badge>
            {r.is_protected && <Badge tone="amber">Chránená</Badge>}
          </div>
          {r.is_protected ? (
            <p className="mt-2 text-sm text-ink-600">Founder má vždy všetky oprávnenia. Rolu nie je možné meniť, odvolať ani prideliť z aplikácie.</p>
          ) : (
            <ActionForm action={setRolePermissionsAction} submit="Uložiť oprávnenia" className="mt-3">
              <input type="hidden" name="role" value={r.key} />
              <div className="grid gap-1 sm:grid-cols-2">
                {ps.filter((p) => p.scope === r.scope).map((p) => (
                  <label key={p.key} className="flex min-h-[36px] items-start gap-2 text-sm">
                    <input type="checkbox" name="perm" value={p.key} defaultChecked={has.has(`${r.id}|${p.key}`)} className="mt-1 h-4 w-4" />
                    <span><code className="text-xs">{p.key}</code> – {p.description}</span>
                  </label>
                ))}
                {ps.filter((p) => p.scope === r.scope).length === 0 && <p className="text-sm text-ink-600">Pre tento rozsah zatiaľ nie sú definované oprávnenia.</p>}
              </div>
            </ActionForm>
          )}
        </section>
      ))}
    </div>
  )
}
