'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type Mode = 'loading' | 'enroll' | 'verify'

function MfaInner() {
  const router = useRouter()
  const params = useSearchParams()
  const raw = params.get('next') ?? '/account'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account'
  const [mode, setMode] = useState<Mode>('loading')
  const [factorId, setFactorId] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal2') return router.replace(next)
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.totp?.find((f) => f.status === 'verified')
      if (verified) {
        setFactorId(verified.id)
        return setMode('verify')
      }
      // nedokončené pokusy o aktiváciu odstránime a začneme nový
      for (const f of data?.totp ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id })
      const res = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SDZ' })
      if (res.error || !res.data) {
        setError('Dvojfaktorové overenie sa nepodarilo pripraviť. Skúste to znova.')
        return setMode('verify')
      }
      setFactorId(res.data.id)
      setSecret(res.data.totp.secret)
      setMode('enroll')
    })()
  }, [router, next])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    setBusy(false)
    if (err) return setError('Kód nie je správny. Skúste znova.')
    router.replace(next)
    router.refresh()
  }

  if (mode === 'loading') return <p className="card text-sm">Načítavam…</p>

  return (
    <div className="card">
      <h1 className="text-xl font-bold text-navy-900">Dvojfaktorové overenie</h1>
      <p className="mt-2 text-sm text-ink-600">
        Centrálne a administrátorské rozhrania vyžadujú dvojfaktorové overenie (TOTP).
      </p>
      {mode === 'enroll' && (
        <div className="mt-4 rounded-md bg-gray-100 p-3 text-sm">
          <p>
            1. V autentifikačnej aplikácii (napr. Google Authenticator, Authy) pridajte účet ručne a zadajte tento kľúč:
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 font-mono">{secret}</code>
          <p className="mt-2">2. Zadajte 6-miestny kód z aplikácie.</p>
        </div>
      )}
      <form onSubmit={submit} className="mt-4">
        <label htmlFor="code" className="label">6-miestny kód</label>
        <input id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" className="input" />
        <button type="submit" disabled={busy || !factorId} className="btn-primary mt-3">
          {busy ? 'Overujem…' : mode === 'enroll' ? 'Aktivovať a pokračovať' : 'Overiť'}
        </button>
        {error && <p role="alert" className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<p className="card text-sm">Načítavam…</p>}>
      <MfaInner />
    </Suspense>
  )
}
