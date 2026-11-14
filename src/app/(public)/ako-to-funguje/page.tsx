import type { Metadata } from 'next'
import { Doc } from '@/components/public'

export const metadata: Metadata = { title: 'Ako to funguje' }

export default function Page() {
  return (
    <Doc title="Ako funguje systém">
      <h2>Organizácie</h2>
      <p>
        Koordinátor s SDZ účtom (minimálne 20 rokov) vyplní registračný formulár, nahrá dokumenty a odošle žiadosť.
        SDZ ju skontroluje a schváli, zamietne alebo vráti na doplnenie. Podanie žiadosti automaticky neznamená
        schválenie.
      </p>
      <h2>Dobrovoľníci</h2>
      <p>
        Registráciu dobrovoľníka iniciuje organizácia pozvánkou. Po overení e-mailu a kontrole zo strany SDZ vznikne
        dobrovoľníkovi trvalé registračné číslo v tvare SDZ-XXXX-XXXX-XXXX a prvá licencia zadarmo.
      </p>
      <h2>Licencia</h2>
      <p>
        Licencia platí najviac 5 rokov, jej obnova je bezplatná a vykonáva ju dobrovoľník sám. Po expirácii ostáva
        profil, členstvo aj história zachované; dobrovoľník sa však nemôže prihlasovať na nové aktivity, kým licenciu
        neobnoví.
      </p>
      <h2>Prestup a hosťovanie</h2>
      <p>
        Dobrovoľník má jednu domovskú organizáciu. Prestup schvaľuje pôvodná aj cieľová organizácia, každá do 30
        kalendárnych dní. Ak organizácia neodpovie, prestup sa automaticky neschváli a vec preverí SDZ. Hosťovanie je
        dočasné a členstvo nemení.
      </p>
    </Doc>
  )
}
