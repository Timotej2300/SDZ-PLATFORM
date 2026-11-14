const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Na túto akciu nemáte oprávnenie.',
  FOUNDER_PROTECTED: 'Pozícia Foundera je chránená a nedá sa zmeniť.',
  SELF_CHANGE: 'Vlastné oprávnenia si nemôžete meniť.',
  USER_NOT_FOUND: 'Používateľ s týmto e-mailom neexistuje.',
  NOT_FOUND: 'Záznam sa nenašiel.',
  DUPLICATE: 'Takýto záznam už existuje.',
  INVALID: 'Neplatné údaje.',
  INVALID_STATE: 'Akciu nie je možné vykonať v aktuálnom stave.',
  LAST_OWNER: 'Organizácia musí mať aspoň jedného vlastníka.',
  ORG_INCOMPLETE: 'Pred odoslaním doplňte kraj, adresu, kontaktný e-mail a popis organizácie.',
  ORG_NO_DOCUMENTS: 'Pred odoslaním nahrajte aspoň jeden dokument.',
  COORDINATOR_AGE: 'Koordinátor musí mať minimálne 20 rokov. Skontrolujte rok narodenia v profile.',
  REASON_REQUIRED: 'Uveďte dôvod.',
  EMAIL_NOT_VERIFIED: 'Dobrovoľník ešte neoveril e-mail.',
  MINOR_NOT_SUPPORTED: 'Registrácia maloletých zatiaľ nie je dostupná (čaká na rozhodnutie o pravidlách).',
  ORG_NOT_AVAILABLE: 'Organizácia nie je dostupná (nie je schválená alebo je pozastavená).',
  INVITATION_INVALID: 'Pozvánka je neplatná, expirovaná alebo patrí inému e-mailu.',
  NOT_VOLUNTEER: 'Najprv musíte byť schválený dobrovoľník.',
  NO_MEMBERSHIP: 'Nemáte domovskú organizáciu.',
  SAME_ORG: 'Vyberte inú organizáciu než vašu domovskú.',
  TRANSFER_OPEN: 'Už máte otvorenú žiadosť o prestup.',
  LICENSE_REQUIRED: 'Na túto akciu potrebujete platnú SDZ licenciu.',
  LICENSE_BLOCKED: 'Licenciu nie je možné obnoviť (je pozastavená alebo zrušená).',
  RENEW_TOO_EARLY: 'Licenciu je možné obnoviť najskôr 90 dní pred expiráciou.',
  IMMUTABLE: 'Tento údaj sa nedá meniť.',
}

export function dbMessage(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? ''
  for (const key of Object.keys(MESSAGES)) {
    if (msg.includes(key)) return MESSAGES[key]
  }
  if (msg.includes('row-level security') || msg.includes('permission denied')) return MESSAGES.FORBIDDEN
  if (msg.includes('duplicate key')) return MESSAGES.DUPLICATE
  if (msg.includes('violates check constraint')) return MESSAGES.INVALID
  return 'Operáciu sa nepodarilo vykonať. Skúste to znova.'
}

export type ActionState = { ok?: string; error?: string; link?: string } | null
