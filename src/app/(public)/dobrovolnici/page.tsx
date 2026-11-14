import type { Metadata } from 'next'
import Link from 'next/link'
import { Doc } from '@/components/public'

export const metadata: Metadata = { title: 'Pre dobrovoľníkov' }

export default function Page() {
  return (
    <Doc title="Informácie pre dobrovoľníkov">
      <p>
        Do systému SDZ sa dobrovoľník dostane cez pozvánku svojej organizácie. Registrácia nie je voľne dostupná
        každému návštevníkovi.
      </p>
      <h2>Čo získate</h2>
      <ul>
        <li>trvalé registračné číslo nezávislé od organizácie,</li>
        <li>bezplatnú SDZ licenciu s platnosťou najviac 5 rokov,</li>
        <li>verejnú registračnú kartu, ktorej zobrazenie si sami nastavujete,</li>
        <li>prehľad prestupov a hosťovaní.</li>
      </ul>
      <h2>Ochrana údajov</h2>
      <p>
        Verejná karta nikdy nezobrazuje adresu, telefón, e-mail, núdzové kontakty ani interné poznámky. Nepovinné údaje
        (fotografia, organizácia, história prestupov) sa zobrazujú iba ak ich povolíte.
      </p>
      <p>
        Hľadáte organizáciu? Pozrite si <Link href="/organizacie" className="font-semibold text-navy-700 underline">zoznam organizácií</Link>.
      </p>
    </Doc>
  )
}
