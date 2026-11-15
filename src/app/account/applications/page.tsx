import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { FormFields } from '@/components/FormFields'
import { Badge, Empty, PageHeader, statusTone } from '@/components/ui'
import { APP_STATUS_LABELS, CONSENT_LABELS, fmtDate, fmtDateTime } from '@/lib/labels'
import type { FormField } from '@/lib/events'
import { orgNameMap } from '@/lib/event-options'
import { cancelApplication, resubmitApplication } from '@/actions/events'

export const metadata = { title: 'Moje prihlášky' }

type App = {
  id: string; status: string; message: string | null; answers: Record<string, unknown>; form_version_id: string | null
  home_org_consent_status: string; decision_note: string | null; submitted_at: string | null
  events: { title: string; slug: string; starts_at: string; ends_at: string; organization_id: string } | null
}

export default async function Page() {
  const ctx = await getContext()
  if (!ctx.volunteer_id) {
    return (
      <div>
        <PageHeader title="Moje prihlášky" />
        <Empty title="Prihlášky sú dostupné po registrácii dobrovoľníka" />
      </div>
    )
  }
  const supabase = await createClient()
  const { data } = await supabase.from('applications')
    .select('id,status,message,answers,form_version_id,home_org_consent_status,decision_note,submitted_at,events(title,slug,starts_at,ends_at,organization_id)')
    .eq('volunteer_id', ctx.volunteer_id).order('created_at', { ascending: false }).limit(100)
  const apps = (data ?? []) as unknown as App[]
  const orgs = await orgNameMap(apps.map((a) => a.events?.organization_id))
  const versionIds = [...new Set(apps.filter((a) => a.status === 'needs_info').map((a) => a.form_version_id).filter(Boolean))] as string[]
  const fields = new Map<string, FormField[]>()
  if (versionIds.length) {
    const { data: fv } = await supabase.from('form_versions').select('id,fields').in('id', versionIds)
    for (const v of (fv ?? []) as { id: string; fields: FormField[] }[]) fields.set(v.id, v.fields)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Moje prihlášky" intro="Na podujatie sa môžete prihlásiť z verejného zoznamu podujatí. Vyžaduje sa platná SDZ licencia.">
        <Link href="/podujatia" className="btn-secondary">Zoznam podujatí</Link>
      </PageHeader>
      {apps.length === 0 ? <Empty title="Zatiaľ nemáte žiadne prihlášky" href="/podujatia" cta="Nájsť podujatie" /> : (
        <div className="space-y-4">
          {apps.map((a) => (
            <article key={a.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{a.events?.title}</h2>
                  <p className="text-sm text-ink-600">{orgs.get(a.events?.organization_id ?? '')?.name} · {fmtDateTime(a.events?.starts_at)} · prihlásený {fmtDate(a.submitted_at)}</p>
                </div>
                <Badge tone={statusTone(a.status === 'assigned' ? 'approved' : a.status)}>{APP_STATUS_LABELS[a.status]}</Badge>
              </div>
              {a.home_org_consent_status !== 'not_required' && (
                <p className="mt-2 text-sm">Súhlas domovskej organizácie: <b>{CONSENT_LABELS[a.home_org_consent_status]}</b></p>
              )}
              {a.decision_note && <p className="mt-2 rounded-md bg-gray-100 px-3 py-2 text-sm">{a.decision_note}</p>}
              {a.status === 'needs_info' && (
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <h3 className="mb-2 text-sm font-semibold">Doplňte prihlášku</h3>
                  <ActionForm action={resubmitApplication} submit="Odoslať doplnenú prihlášku">
                    <input type="hidden" name="id" value={a.id} />
                    <FormFields fields={fields.get(a.form_version_id ?? '') ?? []} values={a.answers ?? {}} />
                    <div className="mb-3">
                      <label htmlFor={`m-${a.id}`} className="label">Správa pre organizátora</label>
                      <textarea id={`m-${a.id}`} name="message" defaultValue={a.message ?? ''} maxLength={1000} className="input" />
                    </div>
                  </ActionForm>
                </div>
              )}
              {['submitted', 'in_review', 'needs_info', 'approved', 'assigned'].includes(a.status) && (
                <ActionForm action={cancelApplication} submit="Zrušiť prihlášku" variant="secondary" confirm="Zrušiť prihlášku?" className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                </ActionForm>
              )}
              {a.events && ['approved', 'assigned', 'submitted', 'in_review'].includes(a.status) && (
                <p className="mt-2 text-sm"><Link href={`/podujatia/${a.events.slug}`} className="text-navy-700 underline">Stránka podujatia</Link></p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
