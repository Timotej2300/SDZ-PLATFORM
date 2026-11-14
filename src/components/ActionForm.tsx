'use client'

import { useActionState, useEffect, useRef } from 'react'
import type { ActionState } from '@/lib/errors'

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  children?: React.ReactNode
  submit: string
  variant?: 'primary' | 'secondary' | 'success' | 'danger'
  confirm?: string
  className?: string
  resetOnSuccess?: boolean
  hideSubmit?: boolean
}

/** Formulár viazaný na Server Action: stav načítania, chyba/úspech, voliteľný potvrdzovací dialóg. */
export function ActionForm({
  action,
  children,
  submit,
  variant = 'primary',
  confirm,
  className,
  resetOnSuccess,
  hideSubmit,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
    >
      {children}
      {!hideSubmit && (
        <button type="submit" disabled={pending} className={`btn-${variant} mt-3`}>
          {pending ? 'Spracúvam…' : submit}
        </button>
      )}
      <div aria-live="polite">
        {state?.error && (
          <p role="alert" className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="fade-in mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-700">{state.ok}</p>
        )}
        {state?.link && (
          <p className="mt-2 break-all rounded-md bg-gray-100 px-3 py-2 text-sm">
            Odkaz na registráciu (odošlite ho dobrovoľníkovi): <br />
            <code>{state.link}</code>
          </p>
        )}
      </div>
    </form>
  )
}
