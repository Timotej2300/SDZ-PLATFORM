'use client'

import { useActionState } from 'react'
import type { ActionState } from '@/lib/errors'

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>

export type Choice = { value: string; label: string; variant: 'success' | 'danger' | 'secondary' | 'primary'; needsReason?: boolean }

/** Rozhodnutie s voliteľným dôvodom (povinný pri voľbách s needsReason). Pole `decision` nesie zvolenú akciu. */
export function DecisionForm({
  action,
  id,
  choices,
  reasonLabel = 'Dôvod / poznámka',
  hiddenName = 'id',
}: {
  action: Action
  id: string
  choices: Choice[]
  reasonLabel?: string
  hiddenName?: string
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const anyReason = choices.some((c) => c.needsReason)
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name={hiddenName} value={id} />
      <input type="hidden" name="decision" defaultValue="" />
      {anyReason && (
        <input name="reason" placeholder={reasonLabel} aria-label={reasonLabel} maxLength={1000} className="input" />
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.value}
            type="submit"
            disabled={pending}
            className={`btn-${c.variant}`}
            onClick={(e) => {
              const form = e.currentTarget.form
              const dec = form?.elements.namedItem('decision') as HTMLInputElement | null
              if (dec) dec.value = c.value
              const reason = form?.elements.namedItem('reason') as HTMLInputElement | null
              if (c.needsReason && reason && reason.value.trim().length < 3) {
                e.preventDefault()
                reason.focus()
                reason.setCustomValidity('Uveďte dôvod')
                reason.reportValidity()
                reason.addEventListener('input', () => reason.setCustomValidity(''), { once: true })
              }
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {state?.error && <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  )
}
