import type { Metadata } from 'next'
import { Doc } from '@/components/public'
import { Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Podujatia' }

export default function Page() {
  return (
    <Doc title="Podujatia">
      <Empty title="Zatiaľ nie sú zverejnené žiadne podujatia" hint="Modul podujatí sa pripravuje a bude spustený v ďalšej fáze vývoja." />
    </Doc>
  )
}
