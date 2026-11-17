export const ORG_TYPE_LABELS: Record<string, string> = {
  civic_association: 'Občianske združenie',
  nonprofit: 'Nezisková organizácia',
  foundation: 'Nadácia',
  school: 'Škola',
  community_center: 'Komunitné centrum',
  festival_organizer: 'Organizátor festivalov',
  other: 'Iná oprávnená organizácia',
}

export const ORG_STATUS_LABELS: Record<string, string> = {
  draft: 'Rozpracovaná',
  submitted: 'Odoslaná',
  in_review: 'V kontrole',
  needs_info: 'Čaká na doplnenie',
  approved: 'Schválená',
  rejected: 'Zamietnutá',
  suspended: 'Pozastavená',
  cancelled: 'Zrušená',
}

export const REG_STATUS_LABELS: Record<string, string> = {
  submitted: 'Odoslaná',
  in_review: 'V kontrole',
  needs_info: 'Čaká na doplnenie',
  approved: 'Schválená',
  rejected: 'Zamietnutá',
}

export const LICENSE_STATUS_LABELS: Record<string, string> = {
  active: 'Aktívna',
  expiring: 'Blíži sa expirácia',
  expired: 'Expirovaná',
  suspended: 'Pozastavená',
  cancelled: 'Zrušená',
}

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  pending_origin: 'Čaká na pôvodnú organizáciu',
  pending_target: 'Čaká na cieľovú organizáciu',
  approved: 'Schválený',
  rejected_origin: 'Zamietnutý pôvodnou organizáciou',
  rejected_target: 'Zamietnutý cieľovou organizáciou',
  cancelled: 'Zrušený',
  overdue_review: 'Po lehote – preveruje SDZ',
}

export const GUESTING_STATUS_LABELS: Record<string, string> = {
  pending_home: 'Čaká na domovskú organizáciu',
  pending_host: 'Čaká na hosťujúcu organizáciu',
  active: 'Aktívne',
  ended: 'Skončené',
  rejected: 'Zamietnuté',
  cancelled: 'Zrušené',
}

export const SCOPE_LABELS: Record<string, string> = {
  system: 'Systém',
  region: 'Región',
  organization: 'Organizácia',
  event: 'Podujatie',
}

export const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rozpracované',
  published: 'Zverejnené',
  cancelled: 'Zrušené',
}

export const APP_STATUS_LABELS: Record<string, string> = {
  draft: 'Rozpracovaná',
  submitted: 'Odoslaná',
  in_review: 'V kontrole',
  needs_info: 'Čaká na doplnenie',
  approved: 'Schválená – čaká na zaradenie',
  assigned: 'Zaradený',
  rejected: 'Zamietnutá',
  cancelled: 'Zrušená',
}

export const CONSENT_LABELS: Record<string, string> = {
  not_required: 'Nie je potrebný',
  pending: 'Čaká na domovskú organizáciu',
  granted: 'Udelený',
  denied: 'Zamietnutý',
}

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Krátky text',
  textarea: 'Dlhý text',
  number: 'Číslo',
  select: 'Výber',
  checkbox: 'Zaškrtávacie pole',
  date: 'Dátum',
}

const TZ = 'Europe/Bratislava'
export const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('sk-SK', { timeZone: TZ }) : '—'
export const fmtDateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }) : '—'

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  new: 'Nová', in_review: 'V riešení', needs_info: 'Čaká na doplnenie',
  resolved: 'Vyriešená', rejected: 'Zamietnutá', withdrawn: 'Stiahnutá',
}
export const COMPLAINT_TARGET_LABELS: Record<string, string> = {
  organization: 'Organizácia', event: 'Podujatie', volunteer: 'Dobrovoľník', sdz: 'SDZ (centrála)', other: 'Iné',
}
export const SUSPENSION_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Naplánované', active: 'Aktívne', lifted: 'Zrušené', expired: 'Skončené',
}
export const DATA_KIND_LABELS: Record<string, string> = {
  access: 'Prístup k údajom', rectification: 'Oprava údajov', erasure: 'Vymazanie údajov',
  restriction: 'Obmedzenie spracúvania', objection: 'Námietka proti spracúvaniu',
}

export const NOTIFICATION_GROUPS: [string, string][] = [
  ['application', 'Prihlášky na podujatia'],
  ['event', 'Podujatia a pripomienky'],
  ['license', 'SDZ licencia'],
  ['transfer', 'Prestupy'],
  ['certificate', 'Certifikáty'],
  ['complaint', 'Sťažnosti'],
  ['announcement', 'Oznamy SDZ'],
]

