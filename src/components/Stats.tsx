export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </div>
  )
}

/** Jednoduchý vodorovný stĺpcový graf bez knižníc. */
export function Bars({ items, unit = '' }: { items: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-1.5" role="list">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate" title={i.label}>{i.label}</span>
          <span className="h-3 rounded bg-gray-100" aria-hidden><span className="block h-3 rounded bg-green-600" style={{ width: `${(i.value / max) * 100}%` }} /></span>
          <span className="tabular-nums text-ink-600">{Number(i.value).toLocaleString('sk-SK', { maximumFractionDigits: 1 })}{unit}</span>
        </li>
      ))}
    </ul>
  )
}

export const countMap = (o: Record<string, number> | undefined, labels: Record<string, string>) =>
  Object.entries(o ?? {}).map(([k, v]) => ({ label: labels[k] ?? k, value: Number(v) }))
