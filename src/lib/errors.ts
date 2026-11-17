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
  EVENT_CLOSED: 'Podujatie nie je otvorené (je zrušené, skončené, nezverejnené alebo organizácia nie je aktívna).',
  DEADLINE_PASSED: 'Termín prihlasovania na podujatie už uplynul.',
  AGE_NOT_ALLOWED: 'Podľa roku narodenia nespĺňate vekovú podmienku podujatia.',
  ALREADY_APPLIED: 'Na toto podujatie už máte prihlášku.',
  FORM_INCOMPLETE: 'Vyplňte všetky povinné polia formulára.',
  FORM_INVALID: 'Formulár obsahuje neplatné údaje.',
  FORM_LOCKED: 'Formulár podujatia sa nedá zmeniť, kým existujú prihlášky.',
  CONSENT_REQUIRED: 'Najprv musí súhlasiť domovská organizácia dobrovoľníka.',
  CAPACITY_FULL: 'Kapacita je naplnená.',
  VOLUNTEER_INACTIVE: 'Dobrovoľnícky účet nie je aktívny.',
  NOT_ASSIGNED: 'Dobrovoľník nie je zaradený na túto pracovnú zmenu.',
  ATTENDANCE_EXISTS: 'Dochádzka na túto zmenu už existuje. Použite opravu.',
  INVALID_TIME: 'Neplatný čas (budúcnosť, mimo zmeny alebo dlhšie ako 24 hodín).',
  EVENT_NOT_ENDED: 'Certifikát je možné vystaviť až po skončení podujatia.',
  NO_HOURS: 'Dobrovoľník nemá na podujatí žiadne odpracované hodiny.',
  ATTENDANCE_OPEN: 'Niektorý záznam dochádzky nemá zapísaný odchod.',
  RATE_LIMIT: 'Dosiahli ste denný limit podaní. Skúste to zajtra.',
  ALREADY_EXISTS: 'Takýto záznam alebo žiadosť už existuje.',
  INVALID_INPUT: 'Skontrolujte vyplnené údaje (povinné polia, minimálna dĺžka textu).',
  MODULE_DISABLED: 'Táto časť systému je dočasne vypnutá. Existujúce údaje zostávajú zachované.',
  IN_USE: 'Položka sa už používa a nedá sa zmazať.',
  HAS_APPLICATIONS: 'Podujatie už má prihlášky, preto sa táto akcia nedá vykonať.',
}

export function dbMessage(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? ''
  // dlhšie kľúče majú prednosť (INVALID_STATE pred INVALID)
  for (const key of Object.keys(MESSAGES).sort((a, b) => b.length - a.length)) {
    if (msg.includes(key)) return MESSAGES[key]
  }
  if (msg.includes('row-level security') || msg.includes('permission denied')) return MESSAGES.FORBIDDEN
  if (msg.includes('duplicate key')) return MESSAGES.DUPLICATE
  if (msg.includes('violates foreign key')) return MESSAGES.IN_USE
  if (msg.includes('violates check constraint')) return MESSAGES.INVALID
  return 'Operáciu sa nepodarilo vykonať. Skúste to znova.'
}

export type ActionState = { ok?: string; error?: string; link?: string } | null
