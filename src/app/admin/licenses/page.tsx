import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, requireCentral } from '@/lib/auth'
import { DecisionForm } from '@/components/DecisionForm'
import { Badge, Empty, PageHeader, Table, Td, licenseTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { setLicenseStatus } from '@/actions/admin'

export const metadata = { title: 'Licencie' }

type Lic = {
  id: string; license_number: string; issued_on: string; expires_on: string; status: string
  volunteers: { registration_number: string; profiles: { first_name: string; last_name: string } | null } | null
}

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; stav?: string }> }) {
  await requireCentral('/admin/licenses')
  const canManage = await hasPermission('licenses.manage')
  if (!canManage && !(await hasPermission('volunteers.read.all'))) redirect('/admin')
  const { q = '', stav = '' } = await searchParams
  const supabase = await createClient()
  let query = supabase
    .from('volunteer_licenses')
    .select('id,license_number,issued_on,expires_on,status,volunteers!inner(registration_number,profiles(first_name,last_name))')
    .order('created_at', { ascending: false })
    .limit(100)
  const term = q.trim().toUpperCase()
  if (/^[A-Z0-9-]{3,20}$/.test(term)) query = term.startsWith('SDZ-L') ? query.eq('license_number', term) : query.ilike('volunteers.registration_number', `%${term}%`)
  if (['active', 'expiring', 'expired', 'suspended', 'cancelled'].includes(stav)) query = query.eq('status', stav)
  const { data } = await query
  const lics = (data ?? []) as unknown as Lic[]

  return (
    <div className="space-y-6">
      <PageHeader title="Licencie" intro="Pozastavenie, zrušenie a obnovenie licencie vyžaduje dôvod a zapisuje sa do auditu." />
      <form className="grid gap-3 sm:grid-cols-[1fr_200px_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Číslo licencie alebo registračné číslo" className="input" aria-label="Hľadať" />
        <select name="stav" defaultValue={stav} className="input" aria-label="Stav">
          <option value="">Všetky stavy</option>
          {Object.entries(LICENSE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-primary" type="submit">Filtrovať</button>
      </form>
      {lics.length === 0 ? <Empty title="Žiadne licencie" /> : (
        <Table head={['Licencia', 'Dobrovoľník', 'Platnosť', 'Stav', canManage ? 'Akcia' : '']}>
          {lics.map((l) => {
            const eff = ['active', 'expiring'].includes(l.status) && new Date(l.expires_on) < new Date() ? 'expired' : l.status
            const choices = [
              ...(['active', 'expiring'].includes(l.status) ? [{ value: 'suspend', label: 'Pozastaviť', variant: 'secondary' as const, needsReason: true }] : []),
              ...(l.status === 'suspended' ? [{ value: 'reinstate', label: 'Obnoviť platnosť', variant: 'success' as const, needsReason: true }] : []),
              ...(['active', 'expiring', 'suspended'].includes(l.status) ? [{ value: 'cancel', label: 'Zrušiť', variant: 'danger' as const, needsReason: true }] : []),
            ]
            return (
              <tr key={l.id}>
                <Td className="font-mono">{l.license_number}</Td>
                <Td>{l.volunteers?.profiles?.first_name} {l.volunteers?.profiles?.last_name}<span className="block font-mono text-xs">{l.volunteers?.registration_number}</span></Td>
                <Td>{fmtDate(l.issued_on)} – {fmtDate(l.expires_on)}</Td>
                <Td><Badge tone={licenseTone(eff)}>{LICENSE_STATUS_LABELS[eff]}</Badge></Td>
                <Td>{canManage && choices.length > 0 ? <DecisionForm action={setLicenseStatus} id={l.id} choices={choices} /> : null}</Td>
              </tr>
            )
          })}
        </Table>
      )}
    </div>
  )
}
