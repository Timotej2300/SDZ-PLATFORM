import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/auth'
import { Badge, PageHeader, statusTone } from '@/components/ui'
import { ORG_STATUS_LABELS } from '@/lib/labels'

export const metadata = { title: 'Organizácia' }

export default async function Page() {
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  const supabase = await createClient()
  const [{ data: o }, members, regs, trs, app] = await Promise.all([
    supabase.from('organizations').select('org_number,status').eq('id', org.id).single(),
    supabase.from('organization_memberships').select('*', { count: 'exact', head: true }).eq('organization_id', org.id).eq('status', 'active'),
    supabase.from('volunteer_registrations').select('*', { count: 'exact', head: true }).eq('organization_id', org.id).in('status', ['submitted', 'in_review', 'needs_info']),
    supabase.from('volunteer_transfers').select('*', { count: 'exact', head: true }).in('status', ['pending_origin', 'pending_target', 'overdue_review']).or(`from_org_id.eq.${org.id},to_org_id.eq.${org.id}`),
    supabase.from('organization_applications').select('status,decision_note').eq('organization_id', org.id).order('submitted_at', { ascending: false }).limit(1),
  ])
  const status = (o?.status as string) ?? org.status
  const note = (app.data?.[0] as { decision_note: string | null } | undefined)?.decision_note
  const stats = [
    ['Aktívni členovia', members.count ?? 0, '/organization/members'],
    ['Otvorené žiadosti o registráciu', regs.count ?? 0, '/organization/registrations'],
    ['Otvorené prestupy', trs.count ?? 0, '/organization/transfers'],
  ] as const

  return (
    <div className="space-y-6">
      <PageHeader title={org.name} intro={o?.org_number ? `Organizačné číslo ${o.org_number}` : 'Organizačné číslo bude pridelené po schválení.'}>
        <Badge tone={statusTone(status)}>{ORG_STATUS_LABELS[status]}</Badge>
      </PageHeader>
      {status === 'draft' && (
        <div className="card border-amber-500 bg-amber-100">
          Žiadosť je rozpracovaná. <Link href="/organization/profile" className="font-semibold underline">Doplňte profil</Link>, nahrajte dokumenty a odošlite ju SDZ.
        </div>
      )}
      {status === 'needs_info' && (
        <div className="card border-amber-500 bg-amber-100">
          SDZ vás žiada o doplnenie{note ? `: ${note}` : '.'} <Link href="/organization/profile" className="font-semibold underline">Upraviť a odoslať znova</Link>.
        </div>
      )}
      {status === 'rejected' && <div className="card border-red-600 bg-red-100">Žiadosť bola zamietnutá{note ? `: ${note}` : '.'}</div>}
      {['submitted', 'in_review'].includes(status) && <div className="card">Žiadosť čaká na kontrolu zo strany SDZ. Podanie žiadosti automaticky neznamená schválenie.</div>}
      {status === 'suspended' && <div className="card border-amber-500 bg-amber-100">Organizácia je pozastavená. Historické údaje ostávajú zachované. Kontaktujte SDZ.</div>}
      {status === 'approved' && (
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map(([label, n, href]) => (
            <Link key={label} href={href} className="card hover:bg-gray-50">
              <p className="text-sm text-ink-600">{label}</p>
              <p className="mt-1 text-3xl font-bold text-navy-900">{n}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
