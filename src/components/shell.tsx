import Link from 'next/link'
import { signOut } from '@/actions/auth'
import { getBranding } from '@/lib/branding'

export async function Logo({ light = false }: { light?: boolean }) {
  const b = await getBranding()
  return (
    <Link href="/" className={`flex items-center gap-2 font-bold ${light ? 'text-white' : 'text-navy-900'}`}>
      <span className="grid h-8 w-8 place-items-center rounded bg-green-600 text-sm text-white">{b.short}</span>
      <span className="hidden sm:inline">{b.name}</span>
    </Link>
  )
}

const PUBLIC_NAV = [
  ['/o-sdz', 'O SDZ'],
  ['/ako-to-funguje', 'Ako to funguje'],
  ['/organizacie', 'Organizácie'],
  ['/podujatia', 'Podujatia'],
  ['/kalendar', 'Kalendár'],
  ['/kontakt', 'Kontakt'],
]

export function PublicHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-gray-300 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-5 text-sm font-medium lg:flex" aria-label="Hlavná navigácia">
          {PUBLIC_NAV.map(([href, label]) => (
            <Link key={href} href={href} className="text-ink-600 hover:text-navy-900">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/account" className="btn-primary">
              Môj účet
            </Link>
          ) : (
            <Link href="/login" className="btn-primary">
              Prihlásiť sa
            </Link>
          )}
          <details className="relative lg:hidden">
            <summary className="btn-secondary cursor-pointer list-none" aria-label="Menu">
              Menu
            </summary>
            <nav className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-gray-300 bg-white p-2 shadow-lg">
              {PUBLIC_NAV.map(([href, label]) => (
                <Link key={href} href={href} className="block rounded px-3 py-3 text-sm hover:bg-gray-100">
                  {label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}

export async function PublicFooter() {
  const b = await getBranding()
  return (
    <footer className="mt-16 bg-navy-900 text-sm text-gray-300">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
        <div>
          <Logo light />
          <p className="mt-3 text-gray-300">{b.tagline}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/pravidla" className="hover:text-white">Pravidlá SDZ</Link>
          <Link href="/dokumenty" className="hover:text-white">Dokumenty</Link>
          <Link href="/ochrana-sukromia" className="hover:text-white">Ochrana osobných údajov</Link>
        </div>
        <p className="text-gray-300">
          SDZ je zatiaľ pripravovaný projekt a identita online platformy. Nie je štátnou inštitúciou ani právne
          ustanoveným národným zväzom.
        </p>
      </div>
    </footer>
  )
}

export type NavItem = { href: string; label: string; badge?: number }

export function AppShell({
  title,
  user,
  nav,
  children,
  side,
}: {
  title: string
  user: string
  nav: NavItem[]
  children: React.ReactNode
  side?: React.ReactNode
}) {
  const links = (
    <ul className="space-y-1">
      {nav.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            className="flex min-h-[44px] items-center justify-between rounded-md px-3 text-sm font-medium text-gray-200 hover:bg-navy-700 hover:text-white"
          >
            {n.label}
            {n.badge ? <span className="rounded bg-green-600 px-1.5 text-xs text-white">{n.badge}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="min-h-screen bg-gray-100 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden bg-navy-900 p-4 lg:block">
        <div className="mb-5">
          <Logo light />
          <p className="mt-2 text-xs uppercase tracking-wide text-gray-300">{title}</p>
        </div>
        {side}
        {links}
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-gray-300 bg-white px-4 py-2">
          <details className="relative lg:hidden">
            <summary className="btn-secondary cursor-pointer list-none">Menu</summary>
            <div className="absolute left-0 z-20 mt-2 w-64 rounded-md bg-navy-900 p-3 shadow-lg">
              {side}
              {links}
            </div>
          </details>
          <span className="hidden text-sm text-ink-600 lg:block">{title}</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:block">{user}</span>
            <Link href="/" className="btn-secondary">Web</Link>
            <form action={signOut}>
              <button className="btn-secondary" type="submit">Odhlásiť</button>
            </form>
          </div>
        </header>
        <main className="fade-in mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
