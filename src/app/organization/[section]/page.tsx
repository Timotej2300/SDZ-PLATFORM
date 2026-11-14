import { notFound } from 'next/navigation'
import { Pending } from '@/components/ui'

const SECTIONS: Record<string, [string, string]> = {
  events: ['Podujatia', 'FÁZA 4 – Podujatia'],
  applications: ['Prihlášky', 'FÁZA 4 – Podujatia'],
  teams: ['Pracovné tímy', 'FÁZA 4 – Podujatia'],
  positions: ['Pozície', 'FÁZA 4 – Podujatia'],
  shifts: ['Pracovné zmeny', 'FÁZA 4 – Podujatia'],
  forms: ['Dynamické formuláre', 'FÁZA 4 – Podujatia'],
  attendance: ['Dochádzka', 'FÁZA 5 – Dochádzka'],
  notifications: ['Oznámenia', 'FÁZA 6 – Notifikácie a štatistiky'],
  analytics: ['Štatistiky', 'FÁZA 6 – Notifikácie a štatistiky'],
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = SECTIONS[section]
  if (!s) notFound()
  return <Pending title={s[0]} phase={s[1]} />
}
