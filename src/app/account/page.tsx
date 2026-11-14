import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getContext, requireUser } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, PageHeader, licenseTone, statusTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, REG_STATUS_LABELS, TRANSFER_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { claimInvitation, resubmitRegistration } from '@/actions/account'

export const metadata = { title: 'Môj účet' }

type Reg = { id: string; status: string; note: string | null; organizations: { name: string } | null }

export default async function Page() {
  const profile = await requireUser()
  const ctx = await getContext()
  const supabase = await createClient()

  if (!ctx.volunteer_id) {
    const { data } = await supabase
      .from('volunteer_registrations')
      .select('id,status,note,organizations(name)')
      .eq('profile_id', profile.id)
      .order('submitted_at', { ascending: false })
      .limit(5)
    const regs = (data ?? []) as unknown as Reg[]
    return (
      <div>
        <PageHeader title={`Vitajte, ${profile.first_name}`} />
        {regs.length > 0 ? (
          <div className="space-y-3">
            {regs.map((r) => (
              <div key={r.id} className="card">
                <p className="text-sm text-ink-600">Registrácia dobrovoľníka · {r.organizations?.name}</p>
                <p className="mt-1"><Badge tone={statusTone(r.status)}>{REG_STATUS_LABELS[r.status] ?? r.status}</Badge></p>
                {r.note && <p className="mt-2 text-sm">Poznámka SDZ: {r.note}</p>}
                {r.status === 'needs_info' && (
                  <ActionForm action={resubmitRegistration} submit="Údaje som doplnil, odoslať znova" className="mt-2">
                    <input type="hidden" name="id" value={r.id} />
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="text-sm text-ink-600">
              Dobrovoľníkom sa môžete stať na pozvanie organizácie. Ak ste dostali kód pozvánky, uplatnite ho tu.
            </p>
            <ActionForm action={claimInvitation} submit="Uplatniť pozvánku" className="mt-3 max-w-md">
              <label htmlFor="token" className="label">Kód pozvánky</label>
              <input id="token" name="token" className="input" required />
            </ActionForm>
            <p className="mt-4 text-sm">
              Zastupujete organizáciu? <Link href="/register/organization" className="text-navy-700 underline">Zaregistrujte ju</Link>.
            </p>
          </div>
        )}
      </div>
    )
  }

  const [{ data: vol }, { data: lic }, { data: transfers }] = await Promise.all([
    supabase.from('volunteers').select('registration_number,status,organizations:home_organization_id(name,slug)').eq('id', ctx.volunteer_id).single(),
    supabase.from('volunteer_licenses').select('license_number,status,expires_on').eq('volunteer_id', ctx.volunteer_id).order('created_at', { ascending: false }).limit(1),
    supabase.from('volunteer_transfers').select('id,status,to_org_name').eq('volunteer_id', ctx.volunteer_id).in('status', ['pending_origin', 'pending_target', 'overdue_review']),
  ])
  const v = vol as unknown as { registration_number: string; status: string; organizations: { name: string; slug: string } | null }
  const l = (lic ?? [])[0] as { license_number: string; status: string; expires_on: string } | undefined
  const expired = l && ['active', 'expiring'].includes(l.status) && new Date(l.expires_on) < new Date()
  const lstatus = expired ? 'expired' : l?.status

  return (
    <div>
      <PageHeader title={`Vitajte, ${profile.first_name}`} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-ink-600">Registračné číslo</p>
          <p className="mt-1 font-mono text-lg font-semibold">{v.registration_number}</p>
          <Link href={`/register/${v.registration_number}`} className="mt-2 inline-block text-sm text-navy-700 underline">Verejná karta</Link>
        </div>
        <div className="card">
          <p className="text-sm text-ink-600">SDZ licencia</p>
          <p className="mt-1">{lstatus && <Badge tone={licenseTone(lstatus)}>{LICENSE_STATUS_LABELS[lstatus]}</Badge>}</p>
          <p className="mt-1 text-sm">Platnosť do {fmtDate(l?.expires_on)}</p>
          <Link href="/account/license" className="mt-2 inline-block text-sm text-navy-700 underline">Spravovať</Link>
        </div>
        <div className="card">
          <p className="text-sm text-ink-600">Domovská organizácia</p>
          <p className="mt-1 font-semibold">{v.organizations?.name ?? '—'}</p>
          <Link href="/account/organizations" className="mt-2 inline-block text-sm text-navy-700 underline">Detail</Link>
        </div>
      </div>
      {(transfers ?? []).length > 0 && (
        <div className="card mt-4">
          <p className="font-semibold">Otvorený prestup</p>
          {(transfers as { id: string; status: string; to_org_name: string }[]).map((t) => (
            <p key={t.id} className="mt-1 text-sm">
              Do {t.to_org_name}: <Badge tone={statusTone(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</Badge>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
