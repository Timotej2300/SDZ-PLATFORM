import type { FormField } from '@/lib/events'

/** Vykreslí polia dynamického formulára (názvy `f_<id>`). `values` = predvyplnené odpovede. */
export function FormFields({ fields, values = {} }: { fields: FormField[]; values?: Record<string, unknown> }) {
  if (fields.length === 0) return null
  return (
    <div>
      {fields.map((f) => {
        const name = `f_${f.id}`
        const v = values[f.id]
        const label = (
          <label htmlFor={name} className="label">
            {f.label}
            {f.required && <span className="text-red-600"> *</span>}
          </label>
        )
        if (f.type === 'checkbox') {
          return (
            <div key={f.id} className="mb-3 flex items-start gap-2">
              <input id={name} name={name} type="checkbox" defaultChecked={v === true} className="mt-1 h-5 w-5" />
              <label htmlFor={name} className="text-sm">
                {f.label}
                {f.required && <span className="text-red-600"> *</span>}
              </label>
            </div>
          )
        }
        return (
          <div key={f.id} className="mb-3">
            {label}
            {f.type === 'textarea' ? (
              <textarea id={name} name={name} defaultValue={v == null ? '' : String(v)} maxLength={2000} className="input" />
            ) : f.type === 'select' ? (
              <select id={name} name={name} defaultValue={v == null ? '' : String(v)} className="input">
                <option value="">— vyberte —</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                id={name}
                name={name}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                step={f.type === 'number' ? 'any' : undefined}
                defaultValue={v == null ? '' : String(v)}
                maxLength={f.type === 'text' ? 2000 : undefined}
                className="input"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Odpovede s názvami polí (na čítanie organizátorom). */
export function AnswersList({ fields, answers }: { fields: FormField[]; answers: Record<string, unknown> }) {
  const rows = fields.filter((f) => answers[f.id] !== undefined && answers[f.id] !== '')
  if (rows.length === 0) return null
  return (
    <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
      {rows.map((f) => (
        <div key={f.id}>
          <dt className="text-ink-600">{f.label}</dt>
          <dd className="whitespace-pre-line">{f.type === 'checkbox' ? (answers[f.id] ? 'Áno' : 'Nie') : String(answers[f.id])}</dd>
        </div>
      ))}
    </dl>
  )
}
