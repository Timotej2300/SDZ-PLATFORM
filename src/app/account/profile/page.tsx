import { createClient } from '@/lib/supabase/server'
import { getContext, requireUser } from '@/lib/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, PageHeader } from '@/components/ui'
import { updatePrivacy, updateProfile, uploadAvatar } from '@/actions/account'

export const metadata = { title: 'Osobný profil' }

export default async function Page() {
  const p = await requireUser()
  const ctx = await getContext()
  const supabase = await createClient()
  let photo: string | null = null
  if (p.avatar_path) {
    const { data } = await supabase.storage.from('avatars').createSignedUrl(p.avatar_path, 300)
    photo = data?.signedUrl ?? null
  }
  let vol: { public_show_photo: boolean; public_show_organization: boolean; public_show_transfer_history: boolean; public_show_history: boolean } | null = null
  if (ctx.volunteer_id) {
    const { data } = await supabase
      .from('volunteers')
      .select('public_show_photo,public_show_organization,public_show_transfer_history,public_show_history')
      .eq('id', ctx.volunteer_id)
      .single()
    vol = data
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Osobný profil" />
      <section className="card">
        <h2 className="font-semibold">Fotografia</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Profilová fotografia" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-gray-200 text-xl font-bold text-navy-700" aria-hidden>
              {p.first_name[0]}{p.last_name[0]}
            </div>
          )}
          <ActionForm action={uploadAvatar} submit="Nahrať fotografiu" className="min-w-[240px] flex-1">
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required className="input pt-2" aria-label="Fotografia" />
            <p className="mt-1 text-xs text-ink-600">JPG, PNG alebo WebP, najviac 2 MB.</p>
          </ActionForm>
        </div>
      </section>
      <section className="card">
        <h2 className="font-semibold">Osobné údaje</h2>
        <ActionForm action={updateProfile} submit="Uložiť" className="mt-3 max-w-lg">
          <Field label="Meno" name="first_name" defaultValue={p.first_name} required maxLength={80} />
          <Field label="Priezvisko" name="last_name" defaultValue={p.last_name} required maxLength={80} />
          <Field label="Rok narodenia" name="birth_year" type="number" defaultValue={p.birth_year} required min={1900} max={new Date().getFullYear()} />
          <Field label="Telefón (nepovinné, nikdy sa nezverejňuje)" name="phone" type="tel" defaultValue={p.phone} maxLength={30} />
          <p className="text-sm text-ink-600">E-mail: {p.email}</p>
        </ActionForm>
      </section>
      {vol && (
        <section className="card">
          <h2 className="font-semibold">Súkromie verejnej karty</h2>
          <p className="mt-1 text-sm text-ink-600">Meno, registračné číslo a stav licencie sú na verejnej karte vždy. Ostatné zobrazíme iba ak povolíte.</p>
          <ActionForm action={updatePrivacy} submit="Uložiť nastavenie" className="mt-3">
            {[
              ['photo', 'Zobraziť profilovú fotografiu', vol.public_show_photo],
              ['organization', 'Zobraziť domovskú organizáciu', vol.public_show_organization],
              ['transfers', 'Zobraziť históriu prestupov', vol.public_show_transfer_history],
              ['history', 'Zobraziť verejnú dobrovoľnícku históriu', vol.public_show_history],
            ].map(([name, label, on]) => (
              <label key={name as string} className="flex min-h-[44px] items-center gap-3 text-sm">
                <input type="checkbox" name={name as string} defaultChecked={on as boolean} className="h-4 w-4" />
                {label as string}
              </label>
            ))}
          </ActionForm>
        </section>
      )}
    </div>
  )
}
