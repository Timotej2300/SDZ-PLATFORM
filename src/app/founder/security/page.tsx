import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { StatusList } from '@/components/StatusList'

export const metadata = { title: 'Bezpečnosť' }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return (
    <div className="space-y-6">
      <PageHeader title="Bezpečnostné nastavenia" intro="Prehľad bezpečnostných pravidiel, ktoré systém vynucuje. Zmena pravidiel vyžaduje zásah do kódu alebo konfigurácie Supabase." />
      <StatusList items={[
        { label: 'Vaša relácia je overená dvojfaktorovo (AAL2)', ok: data?.currentLevel === 'aal2' },
        { label: 'Founder, admin a centrálne roly vyžadujú TOTP', ok: true, detail: 'Vynucuje server pri každom vstupe do /admin a /founder.' },
        { label: 'Ochrana pozície Foundera v databáze', ok: true, detail: 'Trigger odmietne zmenu, odvolanie aj pridelenie roly z aplikácie.' },
        { label: 'Auditné záznamy sú nemenné', ok: true, detail: 'Trigger zakazuje úpravu aj vymazanie.' },
        { label: 'Row Level Security na všetkých tabuľkách', ok: true },
        { label: 'Rate limiting (prihlásenie, registrácia, obnova hesla)', ok: true },
        { label: 'Bezpečnostné hlavičky (CSP, HSTS, X-Frame-Options)', ok: true },
        { label: 'Heslo minimálne 12 znakov', ok: true, detail: 'Aplikačná kontrola; v Supabase Auth nastavte rovnakú minimálnu dĺžku a kontrolu uniknutých hesiel.' },
      ]} />
    </div>
  )
}
