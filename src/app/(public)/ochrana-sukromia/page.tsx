import type { Metadata } from 'next'
import { Doc } from '@/components/public'

export const metadata: Metadata = { title: 'Ochrana osobných údajov' }

export default function Page() {
  return (
    <Doc title="Ochrana osobných údajov">
      <p>
        Toto je pracovné informovanie o spracúvaní údajov v pripravovanej platforme. Pred ostrou prevádzkou ho musí
        posúdiť odborník na ochranu osobných údajov; platforma sa nevyhlasuje za právne súladnú bez takéhoto posúdenia.
      </p>
      <h2>Aké údaje zbierame</h2>
      <ul>
        <li>meno, priezvisko, rok narodenia (bez zbytočného zbierania presného dátumu), e-mail,</li>
        <li>nepovinne telefón a profilová fotografia,</li>
        <li>údaje o členstvách, licenciách, prestupoch a hosťovaniach.</li>
      </ul>
      <h2>Čo je verejné</h2>
      <p>
        Verejná registračná karta nikdy nezobrazuje adresu, telefón, e-mail, núdzové kontakty ani interné poznámky.
        Fotografiu, organizáciu a históriu prestupov zobrazujeme iba na základe vášho nastavenia.
      </p>
      <h2>Vaše práva</h2>
      <p>
        Údaje môžete upravovať v svojom účte. Žiadosti o export, obmedzenie spracúvania alebo vymazanie bude možné
        podať v rámci rozšírenia platformy.
      </p>
    </Doc>
  )
}
