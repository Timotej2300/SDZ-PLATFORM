import type { Metadata } from 'next'
import { Doc } from '@/components/public'

export const metadata: Metadata = { title: 'Pravidlá SDZ' }

export default function Page() {
  return (
    <Doc title="Pravidlá SDZ">
      <p>Prehľad pravidiel, ktoré platforma vynucuje. Ide o pracovné znenie pripravovaného projektu.</p>
      <h2>Registračné číslo</h2>
      <ul>
        <li>Má tvar SDZ-XXXX-XXXX-XXXX, prideľuje sa automaticky a je jedinečné.</li>
        <li>Nikdy sa nemení ani sa znovu nepridelí; zostáva pri prestupe aj po expirácii licencie.</li>
      </ul>
      <h2>Licencia</h2>
      <ul>
        <li>Prvá licencia aj obnova sú bezplatné; maximálna platnosť je 5 rokov.</li>
        <li>Obnovu vykonáva dobrovoľník manuálne, najskôr 90 dní pred expiráciou.</li>
        <li>Po expirácii nie je možné prihlasovať sa na nové aktivity ani prijať nové pridelenie.</li>
        <li>Ak licencia expiruje počas už začatého podujatia, dobrovoľník ho môže dokončiť; výnimka sa eviduje v audite.</li>
      </ul>
      <h2>Členstvo, prestup, hosťovanie</h2>
      <ul>
        <li>Dobrovoľník má maximálne jedno aktívne členstvo (domovskú organizáciu).</li>
        <li>Prestup musia schváliť pôvodná aj cieľová organizácia, každá do 30 kalendárnych dní.</li>
        <li>Po uplynutí lehoty sa prestup automaticky neschváli; nečinnosť preverí SDZ.</li>
        <li>Hosťovanie je dočasné, nevytvára druhé členstvo a je historicky evidované.</li>
      </ul>
    </Doc>
  )
}
