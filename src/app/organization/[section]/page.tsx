import { notFound } from 'next/navigation'
import { Pending } from '@/components/ui'

const SECTIONS: Record<string, [string, string]> = {
  notifications: ['Oznámenia', 'FÁZA 6 – Notifikácie a štatistiky'],
  analytics: ['Štatistiky', 'FÁZA 6 – Notifikácie a štatistiky'],
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = SECTIONS[section]
  if (!s) notFound()
  return <Pending title={s[0]} phase={s[1]} />
}
