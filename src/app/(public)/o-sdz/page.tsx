import type { Metadata } from 'next'
import { Doc } from '@/components/public'

export const metadata: Metadata = { title: 'O SDZ' }

export default function Page() {
  return (
    <Doc title="O SDZ">
      <p>
        Slovenský dobrovoľnícky zväz (SDZ, anglicky Slovak Volunteer Network) je pripravovaná digitálna platforma na
        správu dobrovoľníctva. Prepája dobrovoľníkov, dobrovoľnícke organizácie, organizátorov podujatí, regionálnych
        manažérov a centrálnu administráciu.
      </p>
      <p>
        <strong>Dôležité:</strong> SDZ je zatiaľ pripravovaný projekt a identita online platformy. Nie je štátnou
        inštitúciou ani právne ustanoveným národným zväzom.
      </p>
      <h2>Čo platforma rieši</h2>
      <ul>
        <li>jeden centrálny register dobrovoľníkov s trvalým registračným číslom,</li>
        <li>SDZ licencie s jasnými pravidlami platnosti a obnovy,</li>
        <li>schvaľovanie a evidenciu organizácií,</li>
        <li>členstvá, prestupy a hosťovania medzi organizáciami.</li>
      </ul>
      <p>Platforma sa bude postupne rozširovať z regionálnej úrovne na celé Slovensko.</p>
    </Doc>
  )
}
