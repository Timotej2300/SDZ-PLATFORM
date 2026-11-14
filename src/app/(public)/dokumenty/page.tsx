import type { Metadata } from 'next'
import { Doc } from '@/components/public'
import { Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Dokumenty' }

export default function Page() {
  return (
    <Doc title="Verejné dokumenty">
      <Empty title="Zatiaľ nie sú zverejnené žiadne dokumenty" hint="Pravidlá fungovania nájdete na stránke Pravidlá SDZ." />
    </Doc>
  )
}
