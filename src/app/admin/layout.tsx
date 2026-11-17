import { AppShell, type NavItem } from '@/components/shell'
import { hasPermission, requireCentral, requireUser } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser()
  await requireCentral('/admin')
  const [orgs, review, vols, lic, tr, users, audit, regions, settings, complaints, announce, gdpr, analytics] = await Promise.all([
    hasPermission('orgs.read'), hasPermission('orgs.review'), hasPermission('volunteers.read.all'),
    hasPermission('licenses.manage'), hasPermission('transfers.review'), hasPermission('users.read'),
    hasPermission('audit.read'), hasPermission('regions.manage'), hasPermission('settings.write'),
    hasPermission('complaints.read'), hasPermission('announcements.manage'), hasPermission('gdpr.manage'), hasPermission('analytics.read'),
  ])
  const nav: NavItem[] = [{ href: '/admin', label: 'Prehľad' }]
  if (users) nav.push({ href: '/admin/users', label: 'Používatelia' })
  if (vols) nav.push({ href: '/admin/volunteers', label: 'Register dobrovoľníkov' })
  if (orgs) nav.push({ href: '/admin/organizations', label: 'Organizácie' })
  if (review) nav.push({ href: '/admin/organization-applications', label: 'Žiadosti organizácií' }, { href: '/admin/registrations', label: 'Registrácie dobrovoľníkov' })
  if (lic || vols) nav.push({ href: '/admin/licenses', label: 'Licencie' })
  if (tr || vols) nav.push({ href: '/admin/transfers', label: 'Prestupy' })
  nav.push({ href: '/admin/events', label: 'Podujatia' })
  if (regions || orgs) nav.push({ href: '/admin/regions', label: 'Regióny' })
  if (complaints) nav.push({ href: '/admin/complaints', label: 'Sťažnosti' })
  if (orgs) nav.push({ href: '/admin/moderation', label: 'Moderácia' })
  if (announce) nav.push({ href: '/admin/announcements', label: 'Oznamy' })
  if (gdpr) nav.push({ href: '/admin/gdpr', label: 'Ochrana údajov' })
  nav.push({ href: '/admin/awards', label: 'Ocenenia' })
  if (audit) nav.push({ href: '/admin/audit-logs', label: 'Auditné záznamy' })
  if (analytics) nav.push({ href: '/admin/analytics', label: 'Štatistiky' })
  if (settings) nav.push({ href: '/admin/settings', label: 'Centrálne nastavenia' })
  nav.push({ href: '/account', label: '← Môj účet' })
  return (
    <AppShell title="Administrácia SDZ" user={`${profile.first_name} ${profile.last_name}`} nav={nav}>
      {children}
    </AppShell>
  )
}
