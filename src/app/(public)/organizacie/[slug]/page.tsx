import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ORG_TYPE_LABELS } from '@/lib/labels'

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

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const org = await load((await params).slug)
  if (!org) notFound()
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
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
    </article>
  )
}
