import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContext, getUser } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { FormFields } from '@/components/FormFields'
import { Badge, PageHeader } from '@/components/ui'
import { APP_STATUS_LABELS, fmtDateTime } from '@/lib/labels'
import type { FormField } from '@/lib/events'
import { orgNameMap } from '@/lib/event-options'
import { applyToEvent } from '@/actions/events'

export const dynamic = 'force-dynamic'

type Ev = {
  id: string; slug: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string
  capacity: number | null; min_age: number | null; max_age: number | null; registration_deadline: string | null
  accommodation: boolean; meals: boolean; form_version_id: string | null; status: string
  organization_id: string; regions: { name: string } | null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('title').eq('slug', slug).eq('status', 'published').maybeSingle()
  return { title: data?.title ?? 'Podujatie' }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('events')
    .select('id,slug,title,description,location,starts_at,ends_at,capacity,min_age,max_age,registration_deadline,accommodation,meals,form_version_id,status,organization_id,regions(name)')
    .eq('slug', slug).maybeSingle()
  const e = data as unknown as Ev | null
  if (!e || e.status === 'draft') notFound()
  const orgName = (await orgNameMap([e.organization_id])).get(e.organization_id)?.name

  const user = await getUser()
  const ctx = user ? await getContext() : null
  let existing: { status: string } | null = null
  let fields: FormField[] = []
  const open = e.status === 'published' && new Date(e.ends_at) > new Date()
    && (!e.registration_deadline || new Date(e.registration_deadline) > new Date())
  if (ctx?.volunteer_id) {
    const { data: a } = await supabase.from('applications').select('status').eq('event_id', e.id).eq('volunteer_id', ctx.volunteer_id).maybeSingle()
    existing = a as { status: string } | null
    if (open && e.form_version_id && (!existing || existing.status === 'cancelled')) {
      const { data: fv } = await supabase.from('form_versions').select('fields').eq('id', e.form_version_id).maybeSingle()
      fields = (fv?.fields as FormField[] | undefined) ?? []
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title={e.title} intro={orgName}>
        {e.status === 'cancelled' && <Badge tone="red">Zrušené</Badge>}
      </PageHeader>
      <dl className="card mb-6 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-ink-600">Termín</dt><dd>{fmtDateTime(e.starts_at)} – {fmtDateTime(e.ends_at)}</dd></div>
        <div><dt className="text-ink-600">Miesto</dt><dd>{[e.location, e.regions?.name].filter(Boolean).join(', ') || '—'}</dd></div>
        <div><dt className="text-ink-600">Kapacita</dt><dd>{e.capacity ?? 'neobmedzená'}</dd></div>
        <div><dt className="text-ink-600">Vek (podľa roku narodenia)</dt><dd>{e.min_age || e.max_age ? `${e.min_age ?? 0}${e.max_age ? ` – ${e.max_age}` : '+'}` : 'bez obmedzenia'}</dd></div>
        <div><dt className="text-ink-600">Ubytovanie / strava</dt><dd>{e.accommodation ? 'ubytovanie áno' : 'ubytovanie nie'} · {e.meals ? 'strava áno' : 'strava nie'}</dd></div>
        <div><dt className="text-ink-600">Termín prihlasovania</dt><dd>{e.registration_deadline ? fmtDateTime(e.registration_deadline) : 'do začiatku podujatia'}</dd></div>
      </dl>
      {e.description && <p className="mb-8 whitespace-pre-line">{e.description}</p>}

      <section className="card">
        <h2 className="mb-3 font-semibold">Prihlásenie</h2>
        {!open ? (
          <p className="text-sm">Na toto podujatie sa už nedá prihlásiť.</p>
        ) : !user ? (
          <p className="text-sm">Na prihlásenie sa <Link href={`/login?next=/podujatia/${e.slug}`} className="text-navy-700 underline">prihláste</Link>. Prihlásiť sa môžu dobrovoľníci s platnou SDZ licenciou.</p>
        ) : !ctx?.volunteer_id ? (
          <p className="text-sm">Prihlásiť sa môžu iba registrovaní dobrovoľníci s platnou SDZ licenciou.</p>
        ) : existing && existing.status !== 'cancelled' ? (
          <p className="text-sm">Vaša prihláška: <Badge tone="blue">{APP_STATUS_LABELS[existing.status]}</Badge> <Link href="/account/applications" className="ml-2 text-navy-700 underline">Moje prihlášky</Link></p>
        ) : (
          <ActionForm action={applyToEvent} submit="Odoslať prihlášku">
            <input type="hidden" name="event_id" value={e.id} />
            <FormFields fields={fields} />
            <div className="mb-3">
              <label htmlFor="message" className="label">Správa pre organizátora (nepovinné)</label>
              <textarea id="message" name="message" maxLength={1000} className="input" />
            </div>
            <p className="text-xs text-ink-600">Ak podujatie organizuje iná organizácia ako vaša domovská, musí s prihláškou najprv súhlasiť vaša domovská organizácia.</p>
          </ActionForm>
        )}
      </section>
    </div>
  )
}
