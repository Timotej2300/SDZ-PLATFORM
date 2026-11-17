import { notFound } from 'next/navigation'
import { Pending } from '@/components/ui'

const SECTIONS: Record<string, [string, string]> = {
  modules: ['Správa modulov', 'Čaká na rozhodnutie (pravidlá vypínania modulov zatiaľ nie sú definované)'],
  branding: ['Vizuálna identita', 'Čaká na rozhodnutie'],
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = SECTIONS[section]
  if (!s) notFound()
  return <Pending title={s[0]} phase={s[1]} />
}
