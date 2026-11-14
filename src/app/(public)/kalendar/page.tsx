import type { Metadata } from 'next'
import { Doc } from '@/components/public'
import { Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Kalendár' }

export default function Page() {
  return (
    <Doc title="Verejný kalendár">
      <Empty title="V kalendári zatiaľ nie sú žiadne podujatia" hint="Kalendár bude zobrazovať zverejnené podujatia po spustení modulu podujatí." />
    </Doc>
  )
}
