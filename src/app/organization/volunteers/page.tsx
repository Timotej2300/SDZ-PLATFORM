import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, hasOrgPermission } from '@/lib/auth'
import { Badge, Empty, PageHeader, licenseTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, fmtDate } from '@/lib/labels'

export const metadata = { title: 'Dobrovoľníci' }

type Prof = { first_name: string; last_name: string; email: string; birth_year: number | null; avatar_path: string | null }
type Vol = { registration_number: string; profiles: Prof | null }
type Mem = { volunteer_id: string; volunteers: Vol | null }
type Gst = { id: string; volunteer_id: string; starts_on: string; ends_on: string; home_org_name: string; volunteers: Vol | null }
type Lic = { volunteer_id: string; status: string; expires_on: string }
type Card = { key: string; volunteer_id: string; vol: Vol | null; org: string; guest: boolean; until?: string }

const TABS = [
  ['vsetci', 'Všetci dobrovoľníci'],
  ['domovski', 'Domovskí'],
  ['hostujuci', 'Hosťujúci'],
] as const

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'vsetci', q = '' } = await searchParams
  const { org } = await getCurrentOrg()
  if (!org) redirect('/register/organization')
  if (!(await hasOrgPermission('volunteers.read', org.id))) redirect('/organization')
  const supabase = await createClient()
  const profileCols = 'registration_number,profiles(first_name,last_name,email,birth_year,avatar_path)'
  const [{ data: mems }, { data: gsts }] = await Promise.all([
    supabase.from('organization_memberships').select(`volunteer_id,volunteers(${profileCols})`).eq('organization_id', org.id).eq('status', 'active').limit(1000),
    supabase.from('volunteer_guestings').select(`id,volunteer_id,starts_on,ends_on,home_org_name,volunteers(${profileCols})`).eq('host_org_id', org.id).eq('status', 'active'),
  ])
  const members = (mems ?? []) as unknown as Mem[]
  const guests = (gsts ?? []) as unknown as Gst[]
  let cards: Card[] = [
    ...members.map((m) => ({ key: `m${m.volunteer_id}`, volunteer_id: m.volunteer_id, vol: m.volunteers, org: org.name, guest: false })),
    ...guests.map((g) => ({ key: `g${g.id}`, volunteer_id: g.volunteer_id, vol: g.volunteers, org: g.home_org_name, guest: true, until: g.ends_on })),
  ]
  const total = cards.length
  if (tab === 'domovski') cards = cards.filter((c) => !c.guest)
  if (tab === 'hostujuci') cards = cards.filter((c) => c.guest)
  const needle = q.trim().toLowerCase()
  if (needle) cards = cards.filter((c) => `${c.vol?.profiles?.first_name} ${c.vol?.profiles?.last_name} ${c.vol?.registration_number}`.toLowerCase().includes(needle))
  cards.sort((a, b) => (a.vol?.profiles?.last_name ?? '').localeCompare(b.vol?.profiles?.last_name ?? '', 'sk'))

  const ids = [...new Set(cards.map((c) => c.volunteer_id))]
  const { data: lics } = ids.length
    ? await supabase.from('volunteer_licenses').select('volunteer_id,status,expires_on').in('volunteer_id', ids).order('created_at', { ascending: false })
    : { data: [] }
  const latest = new Map<string, Lic>()
  for (const l of (lics ?? []) as Lic[]) if (!latest.has(l.volunteer_id)) latest.set(l.volunteer_id, l)
  const paths = [...new Set(cards.map((c) => c.vol?.profiles?.avatar_path).filter((p): p is string => !!p))]
  const photo = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('avatars').createSignedUrls(paths, 300)
    for (const s of signed ?? []) if (s.path && s.signedUrl) photo.set(s.path, s.signedUrl)
  }
  const eff = (l?: Lic) => (!l ? null : ['active', 'expiring'].includes(l.status) && new Date(l.expires_on) < new Date() ? 'expired' : l.status)

  return (
    <div className="space-y-6">
      <PageHeader title="Dobrovoľníci" intro="Všetci aktívni členovia a hosťujúci dobrovoľníci organizácie s ich licenciou." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter" className="flex flex-wrap gap-2">
          {TABS.map(([k, label]) => (
            <Link key={k} href={`/organization/volunteers?tab=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={tab === k ? 'btn-primary' : 'btn-secondary'} aria-current={tab === k ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <form className="flex gap-2" role="search">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={q} placeholder="Meno alebo reg. číslo" aria-label="Hľadať" className="input" />
          <button className="btn-secondary" type="submit">Hľadať</button>
        </form>
      </div>
      <p className="text-lg font-semibold text-navy-900">Počet: <span className="ml-1 rounded-full bg-green-600 px-3 py-0.5 text-white">{cards.length}</span>
        {cards.length !== total && <span className="ml-2 text-sm font-normal text-ink-600">z {total}</span>}</p>
      {cards.length === 0 ? <Empty title="Žiadni dobrovoľníci" /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => {
            const p = c.vol?.profiles
            const l = latest.get(c.volunteer_id)
            const s = eff(l)
            const src = p?.avatar_path ? photo.get(p.avatar_path) : undefined
            return (
              <li key={c.key} className="card">
                <h2 className="text-lg font-bold text-navy-900">{p?.last_name} {p?.first_name}</h2>
                <div className="mt-3 flex gap-4">
                  {src
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={src} alt="" className="h-32 w-28 rounded object-cover" />
                    : <div className="grid h-32 w-28 place-items-center rounded bg-gray-100 text-3xl text-gray-400" aria-hidden>{p?.first_name?.[0]}{p?.last_name?.[0]}</div>}
                  <dl className="space-y-2 text-sm">
                    <div><dt className="text-xs font-semibold uppercase text-blue-700">Reg. číslo</dt><dd className="font-mono font-semibold">{c.vol?.registration_number}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-blue-700">Rok narodenia</dt><dd className="font-semibold">{p?.birth_year ?? '—'}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-blue-700">Licencia do</dt>
                      <dd className="font-semibold">{l ? fmtDate(l.expires_on) : '—'} {s && <Badge tone={licenseTone(s)}>{LICENSE_STATUS_LABELS[s]}</Badge>}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-blue-700">{c.guest ? 'Domovská organizácia' : 'Aktuálna organizácia'}</dt>
                      <dd className="font-semibold">{c.org}{c.guest && c.until ? ` (hosťuje do ${fmtDate(c.until)})` : ''}</dd></div>
                  </dl>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
