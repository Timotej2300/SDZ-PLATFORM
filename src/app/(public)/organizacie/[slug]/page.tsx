import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge, licenseTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, ORG_TYPE_LABELS, fmtDate } from '@/lib/labels'

export const dynamic = 'force-dynamic'

type Org = {
  slug: string; name: string; type: string; description: string | null; website: string | null
  org_number: string | null; region_name: string | null; district_name: string | null
}

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('public_organizations')
    .select('slug,name,type,description,website,org_number,region_name,district_name')
    .eq('slug', slug)
    .maybeSingle()
  return data as Org | null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const org = await load((await params).slug)
  return { title: org?.name ?? 'Organizácia' }
}

type PubVol = { registration_number: string; first_name: string; last_name: string; avatar_path: string | null; license_status: string | null; license_expires: string | null }

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await load((await params).slug)
  if (!org) notFound()
  const supabase = await createClient()
  const { data: pv } = await supabase.rpc('public_org_volunteers', { p_slug: org.slug })
  const vols = (pv as { total: number; items: PubVol[] } | null) ?? { total: 0, items: [] }
  const photos = new Map<string, string>()
  const paths = vols.items.map((v) => v.avatar_path).filter((x): x is string => !!x)
  if (paths.length) {
    const { data: signed } = await createAdminClient().storage.from('avatars').createSignedUrls(paths, 300)
    for (const x of signed ?? []) if (x.path && x.signedUrl) photos.set(x.path, x.signedUrl)
  }
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm text-ink-600">{ORG_TYPE_LABELS[org.type] ?? org.type}</p>
      <h1 className="text-3xl font-bold text-navy-900">{org.name}</h1>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        {org.org_number && (<div><dt className="text-ink-600">Registračné číslo organizácie</dt><dd className="font-semibold">{org.org_number}</dd></div>)}
        {org.region_name && (<div><dt className="text-ink-600">Kraj</dt><dd className="font-semibold">{org.region_name}</dd></div>)}
        {org.district_name && (<div><dt className="text-ink-600">Okres</dt><dd className="font-semibold">{org.district_name}</dd></div>)}
        {org.website && (
          <div>
            <dt className="text-ink-600">Web</dt>
            <dd><a href={org.website} rel="noopener noreferrer nofollow" className="font-semibold text-navy-700 underline">{org.website}</a></dd>
          </div>
        )}
      </dl>
      {org.description && <p className="mt-6 whitespace-pre-line leading-relaxed">{org.description}</p>}
      <section className="mt-10" aria-labelledby="vol-h">
        <h2 id="vol-h" className="text-2xl font-bold text-navy-900">Dobrovoľníci organizácie</h2>
        <p className="mt-2 text-lg font-semibold">Počet: <span className="ml-1 rounded-full bg-green-600 px-3 py-0.5 text-white">{vols.total}</span></p>
        <p className="mt-2 text-sm text-ink-600">
          Zobrazujú sa dobrovoľníci, ktorí si povolili zobrazenie svojej organizácie
          {vols.total > vols.items.length ? ` (${vols.items.length} z ${vols.total}).` : '.'} Ostatní zostávajú skrytí. Rok narodenia, e-mail ani telefón sa nikdy nezobrazujú.
        </p>
        {vols.items.length > 0 && (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {vols.items.map((v) => {
              const src = v.avatar_path ? photos.get(v.avatar_path) : undefined
              return (
                <li key={v.registration_number} className="rounded-md border border-gray-300 bg-white p-4">
                  <h3 className="font-bold text-navy-900">{v.last_name} {v.first_name}</h3>
                  <div className="mt-3 flex gap-4">
                    {src
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={src} alt="" className="h-28 w-24 rounded object-cover" />
                      : <div className="grid h-28 w-24 place-items-center rounded bg-gray-100 text-2xl text-gray-400" aria-hidden>{v.first_name[0]}{v.last_name[0]}</div>}
                    <dl className="space-y-2 text-sm">
                      <div><dt className="text-xs font-semibold uppercase text-blue-700">Reg. číslo</dt>
                        <dd><Link href={`/register/${v.registration_number}`} className="font-mono font-semibold underline">{v.registration_number}</Link></dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-blue-700">Licencia do</dt>
                        <dd className="font-semibold">{v.license_expires ? fmtDate(v.license_expires) : '—'} {v.license_status && <Badge tone={licenseTone(v.license_status)}>{LICENSE_STATUS_LABELS[v.license_status]}</Badge>}</dd></div>
                    </dl>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </article>
  )
}
