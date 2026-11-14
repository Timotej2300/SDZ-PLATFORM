import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/auth'
import { Empty, PageHeader, Table, Td } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'

export const metadata = { title: 'Administrácia' }

type Stats = Record<string, number>
type Audit = { id: number; at: string; action: string; entity_type: string; severity: string }

export default async function Page() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_stats')
  const s = error ? null : (data as Stats)
  const canAudit = await hasPermission('audit.read')
  const { data: logs } = canAudit ? await supabase.from('audit_logs').select('id,at,action,entity_type,severity').order('at', { ascending: false }).limit(10) : { data: [] }

  const tiles: [string, number | undefined][] = [
    ['Dobrovoľníci', s?.volunteers],
    ['Schválené organizácie', s?.organizations],
    ['Aktívne licencie', s?.licenses_active],
    ['Expirované licencie', s?.licenses_expired],
    ['Žiadosti organizácií čakajú', s?.org_applications_open],
    ['Registrácie čakajú', s?.registrations_open],
    ['Otvorené prestupy', s?.transfers_open],
    ['Prestupy po lehote', s?.transfers_overdue],
  ]
  return (
    <div className="space-y-6">
      <PageHeader title="Administrácia SDZ" intro="Všetky údaje pochádzajú priamo z databázy. Podujatia, prihlášky a sťažnosti pribudnú s príslušnými modulmi." />
      {s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([label, n]) => (
            <div key={label} className="card">
              <p className="text-sm text-ink-600">{label}</p>
              <p className="mt-1 text-3xl font-bold text-navy-900">{n ?? 0}</p>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Štatistiky nie sú pre vašu rolu dostupné" />
      )}
      {canAudit && (
        <section>
          <h2 className="mb-2 font-semibold">Posledné aktivity</h2>
          <Table head={['Čas', 'Akcia', 'Entita']}>
            {((logs ?? []) as Audit[]).map((l) => (
              <tr key={l.id}><Td>{fmtDateTime(l.at)}</Td><Td>{l.action}</Td><Td>{l.entity_type}</Td></tr>
            ))}
          </Table>
        </section>
      )}
    </div>
  )
}
