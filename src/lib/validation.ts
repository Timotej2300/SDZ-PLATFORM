import { z } from 'zod'

const thisYear = new Date().getFullYear()

const text = (min: number, max: number) => z.string().trim().min(min).max(max)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()

export const emailSchema = z.string().trim().toLowerCase().email('Neplatný e-mail').max(254)

export const passwordSchema = z
  .string()
  .min(12, 'Heslo musí mať aspoň 12 znakov')
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Heslo musí obsahovať písmeno aj číslicu')

export const birthYearSchema = z.coerce
  .number({ invalid_type_error: 'Zadajte rok narodenia' })
  .int()
  .min(1900, 'Neplatný rok narodenia')
  .max(thisYear, 'Neplatný rok narodenia')

export const signUpSchema = z.object({
  first_name: text(1, 80),
  last_name: text(1, 80),
  birth_year: birthYearSchema,
  email: emailSchema,
  password: passwordSchema,
  consent: z.literal('on', { errorMap: () => ({ message: 'Je potrebný súhlas so spracúvaním údajov' }) }),
})

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) })

export const profileSchema = z.object({
  first_name: text(1, 80),
  last_name: text(1, 80),
  birth_year: birthYearSchema,
  phone: optionalText(30),
})

export const ORG_TYPES = [
  'civic_association',
  'nonprofit',
  'foundation',
  'school',
  'community_center',
  'festival_organizer',
  'other',
] as const

export const orgCreateSchema = z.object({
  name: text(2, 160),
  type: z.enum(ORG_TYPES),
})

export const orgProfileSchema = z.object({
  name: text(2, 160),
  type: z.enum(ORG_TYPES),
  description: optionalText(4000),
  address: optionalText(300),
  ico: z
    .string()
    .trim()
    .regex(/^(\d{6,8})?$/, 'IČO má mať 6 až 8 číslic')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  region_id: z.string().uuid('Vyberte kraj'),
  district_id: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.string().uuid().nullable()),
  website: z
    .string()
    .trim()
    .regex(/^(https?:\/\/.+)?$/i, 'Web musí začínať http:// alebo https://')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  contact_email: emailSchema,
  contact_phone: optionalText(30),
})

export const reasonSchema = z.string().trim().min(3, 'Uveďte dôvod').max(1000)
export const uuidSchema = z.string().uuid()

export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'organizacia'
}

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Neplatné údaje'
}
