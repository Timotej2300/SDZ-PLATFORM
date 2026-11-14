import { notFound } from 'next/navigation'
import { Pending } from '@/components/ui'

const SECTIONS: Record<string, [string, string]> = {
  modules: ['Správa modulov', 'FÁZA 8 – Rozšírenie (vypínanie modulov zatiaľ nie je definované)'],
  branding: ['Vizuálna identita', 'FÁZA 8 – Rozšírenie'],
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = SECTIONS[section]
  if (!s) notFound()
  return <Pending title={s[0]} phase={s[1]} />
}
