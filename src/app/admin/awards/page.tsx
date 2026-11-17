import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, Field, PageHeader, Select, Table, Td } from '@/components/ui'
import { fmtDate } from '@/lib/labels'
import { grantAward, revokeAward, saveAwardType } from '@/actions/admin'

export const metadata = { title: 'Ocenenia' }

type T = { id: string; name: string; description: string | null; active: boolean }
type G = { id: string; granted_at: string; note: string | null; volunteer_id: string; award_types: { name: string } | null; volunteers: { registration_number: string } | null }

export default async function Page() {
  await requirePermission('awards.manage', '/admin/awards')
  const supabase = await createClient()
  const [{ data: types }, { data: given }] = await Promise.all([
    supabase.from('award_types').select('id,name,description,active').order('name'),
    supabase.from('volunteer_awards').select('id,granted_at,note,volunteer_id,award_types(name),volunteers(registration_number)').is('revoked_at', null).order('granted_at', { ascending: false }).limit(200),
  ])
  const ts = (types ?? []) as T[]
  const gs = (given ?? []) as unknown as G[]
  return (
    <div className="space-y-6">
      <PageHeader title="SDZ Awards" intro="Architektúra modulu: druhy ocenení a ručné udeľovanie. Bodovanie, prahové hodnoty, kritériá ani automatické udeľovanie zatiaľ nie sú definované (čakajú na rozhodnutie SDZ)." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">Nový druh ocenenia</h2>
          <ActionForm action={saveAwardType} submit="Uložiť" resetOnSuccess className="mt-3">
            <Field label="Názov" name="name" required maxLength={120} />
            <Field label="Popis" name="description" maxLength={1000} />
          </ActionForm>
        </section>
        <section className="card">
          <h2 className="font-semibold">Udeliť ocenenie</h2>
          <ActionForm action={grantAward} submit="Udeliť" resetOnSuccess className="mt-3" confirm="Udeliť ocenenie dobrovoľníkovi?">
            <Field label="Registračné číslo dobrovoľníka" name="reg" required hint="Formát SDZ-RRRR-XXXX-XXXX" />
            <Select label="Ocenenie" name="type" required placeholder="— vyberte —" options={ts.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name }))} />
            <Field label="Poznámka" name="note" maxLength={1000} />
          </ActionForm>
        </section>
      </div>
      {ts.length > 0 && (
        <Table head={['Druh ocenenia', 'Popis', 'Stav']}>
          {ts.map((t) => (
            <tr key={t.id}><Td className="font-semibold">{t.name}</Td><Td>{t.description ?? '—'}</Td><Td><Badge tone={t.active ? 'green' : 'gray'}>{t.active ? 'Aktívne' : 'Vypnuté'}</Badge></Td></tr>
          ))}
        </Table>
      )}
      <h2 className="font-semibold">Udelené ocenenia</h2>
      {gs.length === 0 ? <Empty title="Zatiaľ nebolo udelené žiadne ocenenie" /> : (
        <Table head={['Dobrovoľník', 'Ocenenie', 'Udelené', 'Poznámka', '']}>
          {gs.map((g) => (
            <tr key={g.id}>
              <Td className="font-mono text-xs">{g.volunteers?.registration_number}</Td><Td>{g.award_types?.name}</Td><Td>{fmtDate(g.granted_at)}</Td><Td>{g.note ?? '—'}</Td>
              <Td><ActionForm action={revokeAward} submit="Odobrať" variant="danger" confirm="Odobrať ocenenie?">
                <input type="hidden" name="id" value={g.id} />
                <input name="reason" required minLength={5} placeholder="Dôvod" aria-label="Dôvod" className="input" />
              </ActionForm></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
