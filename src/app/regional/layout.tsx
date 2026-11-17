import { AppShell, type NavItem } from '@/components/shell'
import { requireRegion } from '@/lib/regional'
import { requireUser } from '@/lib/auth'
import { switchRegion } from '@/actions/admin'

export default async function RegionalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser()
  const { regions, region } = await requireRegion()
  const nav: NavItem[] = [
    { href: '/regional', label: 'Prehľad regiónu' },
    { href: '/regional/organizations', label: 'Organizácie' },
    { href: '/regional/volunteers', label: 'Dobrovoľníci' },
    { href: '/regional/events', label: 'Podujatia' },
    { href: '/regional/complaints', label: 'Podnety a sťažnosti' },
    { href: '/regional/analytics', label: 'Štatistiky' },
    { href: '/regional/notifications', label: 'Oznámenia' },
    { href: '/account', label: '← Môj účet' },
  ]
  const side = regions.length > 1 ? (
    <form action={switchRegion} className="mb-4">
      <label htmlFor="region" className="mb-1 block text-xs text-gray-300">Región</label>
      <select id="region" name="region" defaultValue={region.id} className="input mb-2">
        {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <button className="btn-secondary w-full" type="submit">Prepnúť</button>
    </form>
  ) : <p className="mb-4 text-sm font-semibold text-white">{region.name}</p>
  return <AppShell title="Regionálna administrácia" user={`${profile.first_name} ${profile.last_name}`} nav={nav} side={side}>{children}</AppShell>
}
