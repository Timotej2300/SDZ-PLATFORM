import { ActionForm } from '@/components/ActionForm'
import { Field } from '@/components/ui'
import { signUp } from '@/actions/auth'

export function SignUpForm({
  token,
  purpose,
  email,
}: {
  token?: string
  purpose?: 'organization'
  email?: string
}) {
  return (
    <ActionForm action={signUp} submit="Vytvoriť účet">
      {token && <input type="hidden" name="token" value={token} />}
      {purpose && <input type="hidden" name="purpose" value={purpose} />}
      <Field label="Meno" name="first_name" required autoComplete="given-name" maxLength={80} />
      <Field label="Priezvisko" name="last_name" required autoComplete="family-name" maxLength={80} />
      <Field
        label="Rok narodenia"
        name="birth_year"
        type="number"
        required
        min={1900}
        max={new Date().getFullYear()}
        hint="Zbierame iba rok narodenia, nie presný dátum."
      />
      <div className="mb-3">
        <label htmlFor="email" className="label">E-mail <span className="text-red-600">*</span></label>
        <input id="email" name="email" type="email" required defaultValue={email ?? ''} readOnly={!!email} autoComplete="email" className="input read-only:bg-gray-100" />
      </div>
      <Field label="Heslo" name="password" type="password" required autoComplete="new-password" hint="Aspoň 12 znakov, písmeno aj číslica." />
      <label className="mb-1 flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-1 h-4 w-4" required />
        <span>
          Súhlasím so spracúvaním osobných údajov podľa{' '}
          <a href="/ochrana-sukromia" target="_blank" className="text-navy-700 underline">zásad ochrany osobných údajov</a>.
        </span>
      </label>
    </ActionForm>
  )
}
