import { notFound } from 'next/navigation'
import { Pending } from '@/components/ui'

const SECTIONS: Record<string, [string, string]> = {
  applications: ['Prihlášky', 'FÁZA 4 – Podujatia'],
  events: ['Podujatia', 'FÁZA 4 – Podujatia'],
  calendar: ['Kalendár', 'FÁZA 6 – Notifikácie a štatistiky'],
  hours: ['Odpracované hodiny', 'FÁZA 5 – Dochádzka'],
  certificates: ['Certifikáty', 'FÁZA 5 – Dochádzka'],
  history: ['História dobrovoľníckej činnosti', 'FÁZA 5 – Dochádzka'],
  notifications: ['Oznámenia', 'FÁZA 6 – Notifikácie a štatistiky'],
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = SECTIONS[section]
  if (!s) notFound()
  return <Pending title={s[0]} phase={s[1]} />
}
