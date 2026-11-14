import { PageHeader } from '@/components/ui'
import { StatusList } from '@/components/StatusList'

export const metadata = { title: 'Integrácie' }

export default function Page() {
  const set = (k: string) => !!process.env[k]
  return (
    <div className="space-y-6">
      <PageHeader title="Integrácie" intro="Zobrazuje sa iba to, či je konfigurácia nastavená. Hodnoty kľúčov sa nikdy nezobrazujú." />
      <StatusList items={[
        { label: 'Supabase – URL projektu', ok: set('NEXT_PUBLIC_SUPABASE_URL') },
        { label: 'Supabase – verejný (publishable) kľúč', ok: set('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') },
        { label: 'Supabase – service role kľúč (iba server)', ok: set('SUPABASE_SERVICE_ROLE_KEY'), detail: 'Potrebný pre verejnú kartu s fotografiou, blokovanie účtov a cron.' },
        { label: 'Resend – e-maily pozvánok', ok: set('RESEND_API_KEY'), detail: 'Bez kľúča sa pozvánky neodosielajú e-mailom; odkaz sa zobrazí organizácii.' },
        { label: 'Odosielateľ e-mailov (EMAIL_FROM)', ok: set('EMAIL_FROM') },
        { label: 'Vercel Cron (CRON_SECRET)', ok: set('CRON_SECRET') },
        { label: 'Verejná adresa (NEXT_PUBLIC_SITE_URL)', ok: set('NEXT_PUBLIC_SITE_URL') },
      ]} />
      <p className="text-sm text-ink-600">E-maily o overení účtu a obnove hesla odosiela Supabase Auth; na doručovanie cez Resend nastavte v Supabase vlastný SMTP.</p>
    </div>
  )
}
