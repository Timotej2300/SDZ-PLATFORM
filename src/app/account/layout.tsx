import { AppShell, type NavItem } from '@/components/shell'
import { getContext, requireUser } from '@/lib/auth'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser()
  const ctx = await getContext()
  const nav: NavItem[] = [
    { href: '/account', label: 'Prehľad' },
    { href: '/account/profile', label: 'Osobný profil' },
    { href: '/account/license', label: 'SDZ licencia' },
    { href: '/account/organizations', label: 'Domovská organizácia' },
    { href: '/account/transfers', label: 'Prestupy' },
    { href: '/account/applications', label: 'Prihlášky' },
    { href: '/account/events', label: 'Podujatia' },
    { href: '/account/calendar', label: 'Kalendár' },
    { href: '/account/hours', label: 'Odpracované hodiny' },
    { href: '/account/certificates', label: 'Certifikáty' },
    { href: '/account/history', label: 'História činnosti' },
    { href: '/account/notifications', label: 'Oznámenia' },
    { href: '/account/settings', label: 'Nastavenia' },
  ]
  if (ctx.orgs.length > 0) nav.push({ href: '/organization', label: 'Organizačný portál' })
  if (ctx.is_founder) nav.push({ href: '/founder', label: 'Founder Control Center' })
  if (ctx.is_founder || ctx.system_roles.length > 0) nav.push({ href: '/admin', label: 'Administrácia SDZ' })
  return (
    <AppShell title="Môj účet" user={`${profile.first_name} ${profile.last_name}`} nav={nav}>
      {children}
    </AppShell>
  )
}
