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

export const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('sk-SK') : '—'
export const fmtDateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' }) : '—'
