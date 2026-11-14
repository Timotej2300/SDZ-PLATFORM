import type { Metadata } from 'next'
import { Doc } from '@/components/public'

export const metadata: Metadata = { title: 'Kontakt' }

export default function Page() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL
  return (
    <Doc title="Kontakt">
      {email ? (
        <p>
          Napíšte nám na <a className="font-semibold text-navy-700 underline" href={`mailto:${email}`}>{email}</a>.
        </p>
      ) : (
        <p>Kontaktné údaje budú zverejnené po spustení platformy.</p>
      )}
    </Doc>
  )
}
