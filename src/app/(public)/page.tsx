import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STEPS = [
  ['1', 'Organizácia pozve dobrovoľníka', 'Registráciu dobrovoľníka iniciuje organizácia. Nie je voľne otvorená každému návštevníkovi.'],
  ['2', 'SDZ overí registráciu', 'Po kontrole dostane dobrovoľník trvalé registračné číslo a bezplatnú SDZ licenciu.'],
  ['3', 'Dobrovoľník sa zapája', 'Licencia na 5 rokov, domovská organizácia, prestupy a hosťovania podľa jasných pravidiel.'],
]

export default async function HomePage() {
  const supabase = await createClient()
  const { count } = await supabase.from('public_organizations').select('*', { count: 'exact', head: true })
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-100">Slovak Volunteer Network</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">
            Jedno miesto pre všetkých, ktorí chcú pomáhať.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray-300">
            SDZ prepája dobrovoľníkov, dobrovoľnícke organizácie a organizátorov podujatí v jednom
            informačnom systéme s jednotným registrom a licenciami.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/organizacie" className="btn-success">Pozrieť organizácie</Link>
            <Link href="/register/organization" className="btn bg-white text-navy-900 hover:bg-gray-100">
              Podať žiadosť organizácie
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold text-navy-900">Ako to funguje</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="card">
              <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-sm font-bold text-white">{n}</span>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-600">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-ink-600">
          Schválených organizácií v systéme: <strong className="text-navy-900">{count ?? 0}</strong>
        </p>
      </section>
    </>
  )
}
