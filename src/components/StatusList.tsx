import { Badge } from '@/components/ui'

export type StatusItem = { label: string; ok: boolean | null; detail?: string }

export function StatusList({ items }: { items: StatusItem[] }) {
  return (
    <ul className="divide-y divide-gray-200 rounded-md border border-gray-300 bg-white">
      {items.map((i) => (
        <li key={i.label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <span>
            {i.label}
            {i.detail && <span className="block text-xs text-ink-600">{i.detail}</span>}
          </span>
          {i.ok === null ? <Badge>Nezistené</Badge> : i.ok ? <Badge tone="green">V poriadku</Badge> : <Badge tone="amber">Chýba</Badge>}
        </li>
      ))}
    </ul>
  )
}
