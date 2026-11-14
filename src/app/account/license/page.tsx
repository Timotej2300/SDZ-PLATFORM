import { createClient } from '@/lib/supabase/server'
import { getContext, getProfile } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Badge, Empty, PageHeader, Table, Td, licenseTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, fmtDate } from '@/lib/labels'
import { renewLicense } from '@/actions/account'

export const metadata = { title: 'SDZ licencia' }

type Lic = { id: string; license_number: string; issued_on: string; expires_on: string; status: string }

export default async function Page() {
  const ctx = await getContext()
  const profile = await getProfile()
  if (!ctx.volunteer_id) {
    return (
      <div>
        <PageHeader title="SDZ licencia" />
        <Empty title="Licenciu zatiaľ nemáte" hint="Prvá licencia vznikne automaticky po schválení vašej registrácie zo strany SDZ." />
      </div>
    )
  }
  const supabase = await createClient()
  const [{ data }, { data: vol }] = await Promise.all([
    supabase.from('volunteer_licenses').select('id,license_number,issued_on,expires_on,status').eq('volunteer_id', ctx.volunteer_id).order('created_at', { ascending: false }),
    supabase.from('volunteers').select('registration_number').eq('id', ctx.volunteer_id).single(),
  ])
  const lics = (data ?? []) as Lic[]
  const cur = lics[0]
  const eff = (l: Lic) => (['active', 'expiring'].includes(l.status) && new Date(l.expires_on) < new Date() ? 'expired' : l.status)
  const canRenew = cur && !['suspended', 'cancelled'].includes(cur.status)
  const { data: hist } = cur
    ? await supabase.from('license_history').select('id,event,created_at,note').eq('license_id', cur.id).order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-6">
      <PageHeader title="SDZ licencia" intro="Licencia platí najviac 5 rokov. Prvá licencia aj obnova sú bezplatné." />
      {cur && (
        <section className="card">
          <p className="text-sm text-ink-600">Aktuálna licencia</p>
          <p className="mt-1 font-mono text-lg font-semibold">{cur.license_number}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-ink-600">Držiteľ</dt><dd>{profile?.first_name} {profile?.last_name}</dd></div>
            <div><dt className="text-ink-600">Registračné číslo</dt><dd className="font-mono">{vol?.registration_number}</dd></div>
            <div><dt className="text-ink-600">Vydaná</dt><dd>{fmtDate(cur.issued_on)}</dd></div>
            <div><dt className="text-ink-600">Platná do</dt><dd>{fmtDate(cur.expires_on)}</dd></div>
          </dl>
          <p className="mt-3"><Badge tone={licenseTone(eff(cur))}>{LICENSE_STATUS_LABELS[eff(cur)]}</Badge></p>
          {eff(cur) === 'expired' && (
            <p className="mt-3 text-sm">Po expirácii sa nemôžete prihlasovať na nové podujatia ani prijať nové pridelenie. Profil, členstvo a história ostávajú zachované.</p>
          )}
          {canRenew ? (
            <ActionForm action={renewLicense} submit="Obnoviť licenciu" confirm="Obnoviť licenciu na ďalších 5 rokov?" className="mt-3">
              <p className="text-xs text-ink-600">Obnovu je možné vykonať najskôr 90 dní pred expiráciou.</p>
            </ActionForm>
          ) : (
            <p className="mt-3 text-sm text-amber-700">Licenciu momentálne nie je možné obnoviť. Kontaktujte SDZ.</p>
          )}
        </section>
      )}
      <section>
        <h2 className="mb-2 font-semibold">História licencií</h2>
        <Table head={['Číslo', 'Vydaná', 'Platná do', 'Stav']}>
          {lics.map((l) => (
            <tr key={l.id}>
              <Td className="font-mono">{l.license_number}</Td>
              <Td>{fmtDate(l.issued_on)}</Td>
              <Td>{fmtDate(l.expires_on)}</Td>
              <Td><Badge tone={licenseTone(eff(l))}>{LICENSE_STATUS_LABELS[eff(l)]}</Badge></Td>
            </tr>
          ))}
        </Table>
      </section>
      {(hist ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Udalosti aktuálnej licencie</h2>
          <ul className="space-y-1 text-sm">
            {(hist as { id: string; event: string; created_at: string; note: string | null }[]).map((h) => (
              <li key={h.id}>{fmtDate(h.created_at)} · {h.event}{h.note ? ` (${h.note})` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
