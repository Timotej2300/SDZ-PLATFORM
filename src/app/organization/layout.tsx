import { AppShell, type NavItem } from '@/components/shell'
import { Empty } from '@/components/ui'
import { getCurrentOrg, hasOrgPermission, requireUser } from '@/lib/auth'
import { switchOrg } from '@/actions/org'

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser()
  const { ctx, org } = await getCurrentOrg()
  const user = `${profile.first_name} ${profile.last_name}`

  if (!org) {
    return (
      <AppShell title="Organizačný portál" user={user} nav={[{ href: '/account', label: 'Môj účet' }]}>
        <Empty title="Nepôsobíte v žiadnej organizácii" hint="Ak zastupujete organizáciu, vytvorte žiadosť o jej registráciu." href="/register/organization" cta="Registrovať organizáciu" />
      </AppShell>
    )
  }

  const [manage, staff, docs, vols, invite, transfers, evManage, appDecide, evConsent, formsManage, attWrite, certIssue, analytics, respond] = await Promise.all([
    hasOrgPermission('org.manage', org.id),
    hasOrgPermission('org.staff.manage', org.id),
    hasOrgPermission('org.documents', org.id),
    hasOrgPermission('volunteers.read', org.id),
    hasOrgPermission('volunteers.invite', org.id),
    hasOrgPermission('transfers.decide', org.id),
    hasOrgPermission('events.manage', org.id),
    hasOrgPermission('applications.decide', org.id),
    hasOrgPermission('events.consent', org.id),
    hasOrgPermission('forms.manage', org.id),
    hasOrgPermission('attendance.write', org.id),
    hasOrgPermission('certificates.issue', org.id),
    hasOrgPermission('analytics.view', org.id),
    hasOrgPermission('complaints.respond', org.id),
  ])
  const nav: NavItem[] = [{ href: '/organization', label: 'Prehľad' }]
  if (manage) nav.push({ href: '/organization/profile', label: 'Profil organizácie' })
  if (vols) nav.push({ href: '/organization/members', label: 'Členovia' }, { href: '/organization/volunteers', label: 'Dobrovoľníci' })
  if (invite) nav.push({ href: '/organization/registrations', label: 'Žiadosti o registráciu' })
  if (transfers) nav.push({ href: '/organization/transfers', label: 'Prestupy a hosťovania' })
  if (evManage) nav.push({ href: '/organization/events', label: 'Podujatia' })
  if (appDecide || evConsent) nav.push({ href: '/organization/applications', label: 'Prihlášky' })
  if (evManage) nav.push(
    { href: '/organization/teams', label: 'Pracovné tímy' },
    { href: '/organization/positions', label: 'Pozície' },
    { href: '/organization/shifts', label: 'Pracovné zmeny' },
  )
  if (attWrite || certIssue) nav.push({ href: '/organization/attendance', label: 'Dochádzka' })
  if (formsManage) nav.push({ href: '/organization/forms', label: 'Dynamické formuláre' })
  if (docs) nav.push({ href: '/organization/documents', label: 'Dokumenty' })
  nav.push({ href: '/organization/notifications', label: 'Oznámenia' })
  if (analytics) nav.push({ href: '/organization/analytics', label: 'Štatistiky' })
  if (respond) nav.push({ href: '/organization/complaints', label: 'Sťažnosti' })
  if (staff) nav.push({ href: '/organization/staff', label: 'Zamestnanci a pracovníci' })
  nav.push({ href: '/organization/settings', label: 'Nastavenia' }, { href: '/account', label: '← Môj účet' })

  const side =
    ctx.orgs.length > 1 ? (
      <form action={switchOrg} className="mb-4">
        <label htmlFor="org" className="mb-1 block text-xs text-gray-300">Organizácia</label>
        <select id="org" name="org" defaultValue={org.id} className="input mb-2">
          {ctx.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button className="btn-secondary w-full" type="submit">Prepnúť</button>
      </form>
    ) : (
      <p className="mb-4 text-sm font-semibold text-white">{org.name}</p>
    )

  return (
    <AppShell title="Organizačný portál" user={user} nav={nav} side={side}>
      {children}
    </AppShell>
  )
}
