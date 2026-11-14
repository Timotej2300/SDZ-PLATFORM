import { ActionForm } from '@/components/ActionForm'
import { PageHeader } from '@/components/ui'
import { runMaintenance } from '@/actions/founder'

export const metadata = { title: 'Údržba systému' }

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Údržba systému" />
      <section className="card max-w-2xl">
        <h2 className="font-semibold">Denná údržba</h2>
        <p className="mt-1 text-sm text-ink-600">
          Spúšťa sa automaticky raz denne (Vercel Cron). Prepne licencie na „blíži sa expirácia“ a „expirovaná“, označí prestupy
          po 30-dňovej lehote na preverenie (nikdy ich neschváli automaticky) a ukončí skončené hosťovania. Môžete ju spustiť aj ručne.
        </p>
        <ActionForm action={runMaintenance} submit="Spustiť údržbu teraz" confirm="Spustiť dennú údržbu teraz?" />
      </section>
    </div>
  )
}
