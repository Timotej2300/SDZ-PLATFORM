import { createClient } from '@/lib/supabase/server'
import { ActionForm } from '@/components/ActionForm'
import { Badge, PageHeader } from '@/components/ui'
import { setModule } from '@/actions/founder'

export const metadata = { title: 'Správa modulov' }

type M = { key: string; name: string; description: string | null; enabled: boolean }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('system_modules').select('key,name,description,enabled').order('name')
  return (
    <div className="space-y-6">
      <PageHeader title="Správa modulov" intro="Vypnutý modul zablokuje iba vytváranie nových záznamov (podujatí, prihlášok, sťažností, ocenení, oznamov) alebo prístup do portálu. Existujúce údaje a história zostávajú zachované. Každá zmena sa zapíše do auditu." />
      <ul className="space-y-3">
        {((data ?? []) as M[]).map((m) => (
          <li key={m.key} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{m.name} <Badge tone={m.enabled ? 'green' : 'red'}>{m.enabled ? 'Zapnutý' : 'Vypnutý'}</Badge></p>
              <p className="text-sm text-ink-600">{m.description}</p>
            </div>
            <ActionForm action={setModule} submit={m.enabled ? 'Vypnúť' : 'Zapnúť'} variant={m.enabled ? 'danger' : 'success'}
              confirm={m.enabled ? `Naozaj vypnúť modul „${m.name}“?` : undefined}>
              <input type="hidden" name="key" value={m.key} />
              <input type="hidden" name="enabled" value={m.enabled ? '0' : '1'} />
            </ActionForm>
          </li>
        ))}
      </ul>
    </div>
  )
}
