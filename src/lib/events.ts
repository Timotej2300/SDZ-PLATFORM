import { z } from 'zod'
import { slugify } from '@/lib/validation'

/* ========== Čas: zadávanie v slovenskom čase (Europe/Bratislava) ========== */
const TZ = 'Europe/Bratislava'

function tzOffsetMinutes(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000)
}

/** 'YYYY-MM-DDTHH:mm' (slovenský čas) → ISO UTC; neplatný vstup → null */
export function localToIso(v: FormDataEntryValue | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v ?? '').trim())
  if (!m) return null
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let t = naive - tzOffsetMinutes(naive) * 60000
  t = naive - tzOffsetMinutes(t) * 60000
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** ISO → hodnota pre <input type="datetime-local"> v slovenskom čase */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/* ========== Dynamické formuláre ========== */
export const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'checkbox', 'date'] as const
export type FieldType = (typeof FIELD_TYPES)[number]
export type FormField = { id: string; label: string; type: FieldType; required: boolean; options?: string[] }

/** Jeden riadok = jedno pole: typ | názov | * (povinné) | možnosti (pri výbere, oddelené čiarkou) */
export function parseFormFields(text: string): { fields: FormField[] } | { error: string } {
  const fields: FormField[] = []
  const used = new Set<string>()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length > 40) return { error: 'Formulár môže mať najviac 40 polí.' }
  for (const [i, line] of lines.entries()) {
    const parts = line.split('|').map((p) => p.trim())
    const type = parts[0]?.toLowerCase() as FieldType
    const label = parts[1] ?? ''
    if (!FIELD_TYPES.includes(type)) return { error: `Riadok ${i + 1}: neznámy typ „${parts[0]}“. Povolené: ${FIELD_TYPES.join(', ')}.` }
    if (label.length < 1 || label.length > 200) return { error: `Riadok ${i + 1}: chýba názov poľa.` }
    const required = parts[2] === '*'
    let id = slugify(label).replace(/-/g, '_').slice(0, 36)
    if (!/^[a-z]/.test(id)) id = `f_${id}`
    let unique = id
    for (let n = 2; used.has(unique); n++) unique = `${id}_${n}`.slice(-39)
    used.add(unique)
    const field: FormField = { id: unique, label, type, required }
    if (type === 'select') {
      const options = (parts[3] ?? '').split(',').map((o) => o.trim()).filter(Boolean)
      if (options.length < 2 || options.length > 30) return { error: `Riadok ${i + 1}: výber potrebuje 2 až 30 možností oddelených čiarkou.` }
      field.options = [...new Set(options)]
      if (field.options.length < 2) return { error: `Riadok ${i + 1}: možnosti sa opakujú.` }
    }
    fields.push(field)
  }
  return { fields }
}

export function fieldsToText(fields: FormField[]): string {
  return fields
    .map((f) => [f.type, f.label, f.required ? '*' : '', ...(f.options ? [f.options.join(', ')] : [])].join(' | '))
    .join('\n')
}

export function collectAnswers(fields: FormField[], fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = fd.get(`f_${f.id}`)
    out[f.id] = f.type === 'checkbox' ? v === 'on' : typeof v === 'string' ? v : ''
  }
  return out
}

/* ========== Podujatie ========== */
const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(min).max(max).nullable(),
  )

export const eventSchema = z.object({
  title: z.string().trim().min(3, 'Názov musí mať aspoň 3 znaky').max(200),
  description: z.string().trim().max(8000),
  location: z.string().trim().max(300),
  region_id: z.string().transform((v) => (v === '' ? null : v)).pipe(z.string().uuid().nullable()),
  starts_at: z.string().min(1, 'Zadajte začiatok'),
  ends_at: z.string().min(1, 'Zadajte koniec'),
  registration_deadline: z.string(),
  capacity: optInt(1, 100000),
  min_age: optInt(0, 120),
  max_age: optInt(0, 120),
  form_version_id: z.string().transform((v) => (v === '' ? null : v)).pipe(z.string().uuid().nullable()),
})

export const teamSchema = z.object({
  name: z.string().trim().min(2, 'Názov musí mať aspoň 2 znaky').max(120),
  description: z.string().trim().max(1000),
  capacity: optInt(1, 100000),
})
