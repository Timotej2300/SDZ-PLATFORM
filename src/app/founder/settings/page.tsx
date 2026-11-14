import { createClient } from '@/lib/supabase/server'
import { PageHeader, Table, Td } from '@/components/ui'

export const metadata = { title: 'Globálne nastavenia' }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('system_settings').select('key,value,description,updated_at').order('key')
  return (
    <div className="space-y-6">
      <PageHeader title="Globálne nastavenia" intro="Pravidlá, ktoré SDZ zatiaľ nedefinovalo, sú v systéme pripravené, ale vypnuté. Ich zapnutie bude doplnené po schválení presných pravidiel." />
      <Table head={['Kľúč', 'Hodnota', 'Popis']}>
        {((data ?? []) as { key: string; value: unknown; description: string | null }[]).map((s) => (
          <tr key={s.key}><Td className="font-mono">{s.key}</Td><Td className="font-mono">{JSON.stringify(s.value)}</Td><Td>{s.description}</Td></tr>
        ))}
      </Table>
      <p className="text-sm text-ink-600">
        Pevné pravidlá platformy (platnosť licencie najviac 5 rokov, lehota 30 dní na rozhodnutie o prestupe, automatické neschvaľovanie po lehote) sú vynútené v databáze a nie sú nastaviteľné.
      </p>
    </div>
  )
}
