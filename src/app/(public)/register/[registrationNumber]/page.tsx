import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge, licenseTone } from '@/components/ui'
import { LICENSE_STATUS_LABELS, fmtDate } from '@/lib/labels'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Registračná karta dobrovoľníka', robots: { index: false, follow: false } }

type Card = {
  registration_number: string
  first_name: string
  last_name: string
  avatar_path: string | null
  license_status: string | null
  volunteer_status: string
  organization: { name: string; slug: string } | null
  transfer_history: { from: string; to: string; date: string }[] | null
}

export default async function Page({ params }: { params: Promise<{ registrationNumber: string }> }) {
  const { registrationNumber } = await params
  if (!/^SDZ-\d{4}-\d{4}-\d{4}$/.test(registrationNumber)) notFound()
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_card', { p_reg: registrationNumber })
  if (!data) notFound()
  const card = data as Card

  let photo: string | null = null
  if (card.avatar_path) {
    try {
      const { data: signed } = await createAdminClient().storage.from('avatars').createSignedUrl(card.avatar_path, 300)
      photo = signed?.signedUrl ?? null
    } catch {
      photo = null
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card text-center">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="mx-auto h-28 w-28 rounded-full object-cover" />
        ) : (
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-gray-200 text-3xl font-bold text-navy-700" aria-hidden>
            {card.first_name[0]}{card.last_name[0]}
          </div>
        )}
        <h1 className="mt-4 text-2xl font-bold text-navy-900">{card.first_name} {card.last_name}</h1>
        <p className="mt-1 font-mono text-lg">{card.registration_number}</p>
        <div className="mt-3 flex justify-center gap-2">
          <Badge tone={licenseTone(card.license_status)}>
            Licencia: {card.license_status ? LICENSE_STATUS_LABELS[card.license_status] : 'neevidovaná'}
          </Badge>
          {card.volunteer_status === 'suspended' && <Badge tone="amber">Dobrovoľník pozastavený</Badge>}
        </div>
        {card.organization && (
          <p className="mt-5 text-sm">
            Organizácia: <Link href={`/organizacie/${card.organization.slug}`} className="font-semibold text-navy-700 underline">{card.organization.name}</Link>
          </p>
        )}
        {card.transfer_history && card.transfer_history.length > 0 && (
          <div className="mt-5 text-left text-sm">
            <p className="font-semibold">História prestupov</p>
            <ul className="mt-1 space-y-1">
              {card.transfer_history.map((t, i) => (
                <li key={i} className="text-ink-600">{fmtDate(t.date)}: {t.from} → {t.to}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-ink-600">
        Údaje zobrazuje SDZ podľa nastavenia súkromia dobrovoľníka. Adresa, telefón ani e-mail sa nikdy nezverejňujú.
      </p>
    </div>
  )
}
