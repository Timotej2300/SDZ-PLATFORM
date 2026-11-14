import { notFound } from 'next/navigation'
import { Pending } from '@/components/ui'

const SECTIONS: Record<string, [string, string]> = {
  events: ['Podujatia', 'FÁZA 4 – Podujatia'],
  complaints: ['Sťažnosti', 'FÁZA 7 – Dohľad a bezpečnosť'],
  moderation: ['Moderácia', 'FÁZA 7 – Dohľad a bezpečnosť'],
  awards: ['Ocenenia', 'FÁZA 8 – Rozšírenie (pravidlá ocenení zatiaľ nie sú definované)'],
  analytics: ['Štatistiky', 'FÁZA 6 – Notifikácie a štatistiky'],
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = SECTIONS[section]
  if (!s) notFound()
  return <Pending title={s[0]} phase={s[1]} />
}
