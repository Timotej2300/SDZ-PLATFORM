import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge, Empty, Table, Td } from '@/components/ui'
import { fmtDateTime } from '@/lib/labels'

type Row = { id: number; at: string; actor_id: string | null; severity: string; action: string; entity_type: string; entity_id: string | null }
const PAGE = 50

export async function AuditTable({ basePath, q, severity, page, onlyCritical }: { basePath: string; q: string; severity: string; page: number; onlyCritical?: boolean }) {
  const supabase = await createClient()
  let query = supabase.from('audit_logs').select('id,at,actor_id,severity,action,entity_type,entity_id').order('at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE)
  const term = q.trim().replace(/[%,()*]/g, ' ').slice(0, 60)
  if (term) query = query.ilike('action', `%${term}%`)
  if (onlyCritical) query = query.eq('severity', 'critical')
  else if (['info', 'warning', 'critical'].includes(severity)) query = query.eq('severity', severity)
  const { data } = await query
  const rows = (data ?? []) as Row[]
  const more = rows.length > PAGE
  const shown = rows.slice(0, PAGE)
  const href = (p: number) => `${basePath}?q=${encodeURIComponent(q)}&severity=${severity}&page=${p}`

  return (
    <div className="space-y-4">
      <form className="grid gap-3 sm:grid-cols-[1fr_200px_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Akcia (napr. role, license)" className="input" aria-label="Akcia" />
        {!onlyCritical && (
          <select name="severity" defaultValue={severity} className="input" aria-label="Závažnosť">
            <option value="">Všetky</option><option value="info">info</option><option value="warning">warning</option><option value="critical">critical</option>
          </select>
        )}
        <button className="btn-primary" type="submit">Filtrovať</button>
      </form>
      {shown.length === 0 ? <Empty title="Žiadne záznamy" /> : (
        <Table head={['Čas', 'Závažnosť', 'Akcia', 'Entita', 'Aktér']}>
          {shown.map((r) => (
            <tr key={r.id}>
              <Td>{fmtDateTime(r.at)}</Td>
              <Td><Badge tone={r.severity === 'critical' ? 'red' : r.severity === 'warning' ? 'amber' : 'gray'}>{r.severity}</Badge></Td>
              <Td>{r.action}</Td>
              <Td>{r.entity_type}<span className="block font-mono text-xs text-ink-600">{r.entity_id}</span></Td>
              <Td className="font-mono text-xs">{r.actor_id?.slice(0, 8) ?? 'systém'}</Td>
            </tr>
          ))}
        </Table>
      )}
      <div className="flex gap-2">
        {page > 0 && <Link className="btn-secondary" href={href(page - 1)}>← Novšie</Link>}
        {more && <Link className="btn-secondary" href={href(page + 1)}>Staršie →</Link>}
      </div>
    </div>
  )
}
