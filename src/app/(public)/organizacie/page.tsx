import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Empty, PageHeader } from '@/components/ui'
import { ORG_TYPE_LABELS } from '@/lib/labels'

export const metadata: Metadata = { title: 'Organizácie' }
export const dynamic = 'force-dynamic'

type Org = { slug: string; name: string; type: string; region_name: string | null; district_name: string | null; description: string | null }

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; kraj?: string }> }) {
  const { q = '', kraj = '' } = await searchParams
  const supabase = await createClient()
  const { data: regions } = await supabase.from('regions').select('id,name').order('name')
  let query = supabase
    .from('public_organizations')
    .select('slug,name,type,region_name,district_name,description')
    .order('name')
    .limit(200)
  const term = q.trim().replace(/[%,()]/g, ' ').slice(0, 80)
  if (term) query = query.ilike('name', `%${term}%`)
  if (/^[0-9a-f-]{36}$/.test(kraj)) query = query.eq('region_id', kraj)
  const { data } = await query
  const orgs = (data ?? []) as Org[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader title="Organizácie" intro="Verejný zoznam schválených dobrovoľníckych organizácií." />
      <form className="mb-6 grid gap-3 sm:grid-cols-[1fr_240px_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Hľadať podľa názvu" className="input" aria-label="Hľadať podľa názvu" />
        <select name="kraj" defaultValue={kraj} className="input" aria-label="Kraj">
          <option value="">Všetky kraje</option>
          {(regions ?? []).map((r: { id: string; name: string }) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <button className="btn-primary" type="submit">Filtrovať</button>
      </form>
      {orgs.length === 0 ? (
        <Empty title="Nenašli sme žiadne organizácie" hint="Skúste zmeniť filter, alebo sa vráťte neskôr." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => (
            <li key={o.slug} className="card">
              <Link href={`/organizacie/${o.slug}`} className="font-semibold text-navy-900 hover:underline">{o.name}</Link>
              <p className="mt-1 text-xs text-ink-600">
                {ORG_TYPE_LABELS[o.type] ?? o.type}
                {o.region_name ? ` · ${o.region_name}` : ''}
              </p>
              {o.description && <p className="mt-2 line-clamp-3 text-sm text-ink-600">{o.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
