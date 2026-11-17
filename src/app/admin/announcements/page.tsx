import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Empty, PageHeader, Select, Table, Td } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'
import { publishAnnouncement } from '@/actions/notifications'

export const metadata = { title: 'Oznamy' }

const AUD: Record<string, string> = { all: 'Všetci používatelia', volunteers: 'Dobrovoľníci', org_staff: 'Pracovníci organizácií' }

export default async function Page() {
  await requirePermission('announcements.manage', '/admin/announcements')
  const supabase = await createClient()
  const { data } = await supabase.from('announcements').select('id,title,audience,send_email,created_at,expires_at').order('created_at', { ascending: false }).limit(100)
  const rows = (data ?? []) as { id: string; title: string; audience: string; send_email: boolean; created_at: string; expires_at: string | null }[]
  return (
    <div className="space-y-6">
      <PageHeader title="Systémové oznamy" intro="Oznam sa okamžite zobrazí v oznámeniach adresátov a voliteľne sa pošle e-mailom. Odoslané oznamy sa nedajú stiahnuť." />
      <section className="card">
        <ActionForm action={publishAnnouncement} submit="Zverejniť oznam" confirm="Oznam sa odošle všetkým vybraným adresátom. Pokračovať?" resetOnSuccess>
          <div className="mb-3"><label htmlFor="title" className="label">Nadpis *</label><input id="title" name="title" required minLength={3} maxLength={200} className="input" /></div>
          <div className="mb-3"><label htmlFor="body" className="label">Text *</label><textarea id="body" name="body" required minLength={3} maxLength={4000} rows={5} className="input" /></div>
          <Select label="Adresáti" name="audience" required options={Object.entries(AUD).map(([value, label]) => ({ value, label }))} />
          <div className="mb-3"><label htmlFor="expires" className="label">Zobrazovať do (nepovinné)</label><input id="expires" name="expires" type="datetime-local" className="input" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email" /> Poslať aj e-mailom</label>
        </ActionForm>
      </section>
      {rows.length === 0 ? <Empty title="Zatiaľ žiadne oznamy" /> : (
        <Table head={['Nadpis', 'Adresáti', 'E-mail', 'Zverejnený', 'Platí do']}>
          {rows.map((r) => (
            <tr key={r.id}><Td className="font-semibold">{r.title}</Td><Td>{AUD[r.audience]}</Td><Td>{r.send_email ? 'áno' : 'nie'}</Td><Td>{fmtDateTime(r.created_at)}</Td><Td>{r.expires_at ? fmtDateTime(r.expires_at) : '—'}</Td></tr>
          ))}
        </Table>
      )}
    </div>
  )
}
