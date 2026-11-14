import Link from 'next/link'

export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-sm text-ink-600">{intro}</p>}
      </div>
      {children}
    </div>
  )
}

const TONES = {
  gray: 'bg-gray-100 text-ink-600',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-gray-200 text-navy-800',
}

export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
}

export function licenseTone(s: string | null | undefined): keyof typeof TONES {
  if (s === 'active') return 'green'
  if (s === 'expiring') return 'amber'
  if (s === 'expired' || s === 'cancelled') return 'red'
  if (s === 'suspended') return 'amber'
  return 'gray'
}

export function statusTone(s: string): keyof typeof TONES {
  if (['approved', 'active'].includes(s)) return 'green'
  if (['rejected', 'cancelled', 'rejected_origin', 'rejected_target', 'suspended'].includes(s)) return 'red'
  if (['needs_info', 'overdue_review'].includes(s)) return 'amber'
  return 'blue'
}

export function Empty({ title, hint, href, cta }: { title: string; hint?: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
      <p className="font-semibold text-navy-900">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">{hint}</p>}
      {href && cta && (
        <Link href={href} className="btn-primary mt-4">
          {cta}
        </Link>
      )}
    </div>
  )
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-300">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-gray-100 text-xs uppercase tracking-wide text-ink-600">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">{children}</tbody>
      </table>
    </div>
  )
}
export const Td = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
)

export function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  hint,
  autoComplete,
  min,
  max,
  maxLength,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string | number | null
  required?: boolean
  hint?: string
  autoComplete?: string
  min?: number
  max?: number
  maxLength?: number
}) {
  return (
    <div className="mb-3">
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={required}
        autoComplete={autoComplete}
        min={min}
        max={max}
        maxLength={maxLength}
        className="input"
      />
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </div>
  )
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  required,
  placeholder,
}: {
  label: string
  name: string
  options: { value: string; label: string }[]
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="mb-3">
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <select id={name} name={name} defaultValue={defaultValue ?? ''} required={required} className="input">
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Pending({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Empty title="Táto časť ešte nie je dostupná" hint={`Modul sa pripravuje a bude doplnený vo fáze „${phase}“.`} />
    </div>
  )
}
