import { AppShell, type NavItem } from '@/components/shell'
import { requireFounder, requireUser } from '@/lib/auth'

const NAV: NavItem[] = [
  { href: '/founder', label: 'Prehľad' },
  { href: '/founder/roles', label: 'Roly' },
  { href: '/founder/permissions', label: 'Oprávnenia' },
  { href: '/founder/administrators', label: 'Administrátori' },
  { href: '/founder/users', label: 'Používatelia' },
  { href: '/founder/settings', label: 'Globálne nastavenia' },
  { href: '/founder/modules', label: 'Moduly' },
  { href: '/founder/regions', label: 'Regióny' },
  { href: '/founder/branding', label: 'Vizuálna identita' },
  { href: '/founder/integrations', label: 'Integrácie' },
  { href: '/founder/security', label: 'Bezpečnosť' },
  { href: '/founder/audit', label: 'Systémový audit' },
  { href: '/founder/maintenance', label: 'Údržba' },
  { href: '/founder/system', label: 'Stav systému' },
  { href: '/admin', label: 'Administrácia SDZ' },
  { href: '/account', label: '← Môj účet' },
]

export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser()
  await requireFounder('/founder')
  return (
    <AppShell title="Founder Control Center" user={`${profile.first_name} ${profile.last_name}`} nav={NAV}>
      {children}
    </AppShell>
  )
}
