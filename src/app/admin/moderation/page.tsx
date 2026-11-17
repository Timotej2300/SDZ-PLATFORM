import { createClient } from '@/lib/supabase/server'
import { requirePermission, hasPermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, PageHeader, Select, Table, Td } from '@/components/ui'
import { SUSPENSION_STATUS_LABELS, fmtDateTime } from '@/lib/labels'
import { liftSuspension, suspendOrganization } from '@/actions/oversight'

export const metadata = { title: 'Moderácia – pozastavenie organizácií' }

type S = { id: string; organization_id: string; reason: string; starts_at: string; ends_at: string | null; status: string; lift_note: string | null }

export default async function Page() {
  await requirePermission('orgs.read', '/admin/moderation')
  const canSuspend = await hasPermission('orgs.suspend')
  const supabase = await createClient()
  const [{ data }, { data: orgs }] = await Promise.all([
    supabase.from('organization_suspensions').select('id,organization_id,reason,starts_at,ends_at,status,lift_note').order('created_at', { ascending: false }).limit(200),
    supabase.from('organizations').select('id,name,status').order('name').limit(1000),
  ])
  const rows = (data ?? []) as S[]
  const all = (orgs ?? []) as { id: string; name: string; status: string }[]
  const name = new Map(all.map((o) => [o.id, o.name]))
  const open = new Set(rows.filter((r) => ['active', 'scheduled'].includes(r.status)).map((r) => r.organization_id))
  const candidates = all.filter((o) => o.status === 'approved' && !open.has(o.id)).map((o) => ({ value: o.id, label: o.name }))
  return (
    <div className="space-y-6">
      <PageHeader title="Moderácia" intro="Pozastavená organizácia nemôže vytvárať podujatia ani prijímať prihlášky, jej podujatia sa skryjú z verejných zoznamov a jej tím má iba čítanie. Už začaté podujatia môžu dokončiť dochádzku. História a údaje zostávajú zachované." />
      {canSuspend && (
        <section className="card">
          <h2 className="font-semibold">Pozastaviť organizáciu</h2>
          <ActionForm action={suspendOrganization} submit="Pozastaviť" variant="danger" confirm="Naozaj pozastaviť organizáciu?" resetOnSuccess>
            <Select label="Organizácia" name="org_id" required placeholder="— vyberte —" options={candidates} />
            <div className="mb-3"><label htmlFor="reason" className="label">Dôvod * (zapíše sa do auditu)</label><textarea id="reason" name="reason" required minLength={10} maxLength={2000} rows={3} className="input" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="starts" className="label">Od (prázdne = ihneď)</label><input id="starts" name="starts" type="datetime-local" className="input" /></div>
              <div><label htmlFor="ends" className="label">Do (prázdne = do zrušenia)</label><input id="ends" name="ends" type="datetime-local" className="input" /></div>
            </div>
          </ActionForm>
        </section>
      )}
      {rows.length === 0 ? <Empty title="Zatiaľ žiadne pozastavenia" /> : (
        <Table head={['Organizácia', 'Dôvod', 'Obdobie', 'Stav', '']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="font-semibold">{name.get(r.organization_id) ?? '—'}</Td>
              <Td>{r.reason}{r.lift_note && <span className="block text-xs text-ink-600">Zrušenie: {r.lift_note}</span>}</Td>
              <Td>{fmtDateTime(r.starts_at)}{r.ends_at ? ` – ${fmtDateTime(r.ends_at)}` : ' – neurčito'}</Td>
              <Td><Badge tone={r.status === 'active' ? 'red' : r.status === 'scheduled' ? 'amber' : 'gray'}>{SUSPENSION_STATUS_LABELS[r.status]}</Badge></Td>
              <Td>{canSuspend && ['active', 'scheduled'].includes(r.status) && (
                <ActionForm action={liftSuspension} submit="Zrušiť" variant="secondary" confirm="Zrušiť pozastavenie?">
                  <input type="hidden" name="org_id" value={r.organization_id} />
                  <input name="reason" placeholder="Poznámka" aria-label="Poznámka" className="input" maxLength={500} />
                </ActionForm>)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
