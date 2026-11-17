# SDZ – Slovenský dobrovoľnícky zväz (FÁZY 1–5)

Next.js (App Router) + Supabase + Vercel. Stav: FÁZA 1 (základy), 2 (organizácie), 3 (dobrovoľníci), 4 (podujatia, formuláre, prihlášky), 5 (dochádzka, hodiny, certifikáty) hotové.

## Nastavenie
1. Supabase projekt (región EÚ). Spusti migrácie z `supabase/migrations/` v poradí (SQL Editor alebo `supabase db push`).
2. Supabase → Auth: povoliť e-mail potvrdenie, MFA (TOTP), Site URL a Redirect URL `https://<domena>/auth/callback`; minimálna dĺžka hesla 12.
3. `cp .env.example .env.local` a doplniť hodnoty (service role kľúč iba na serveri).
4. Prvý Founder: zaregistruj účet, over e-mail, potom v SQL Editore: `select public.founder_bootstrap('tvoj@email.sk');`
5. `npm install && npm run dev`. Vercel: pridať env premenné vrátane `CRON_SECRET`.

## Testy
`supabase/tests/00_stub.sql` + migrácie + `01_rules.sql` + `02_events.sql` (podujatia, prihlášky, súhlas domovskej organizácie, dochádzka, licencia počas podujatia, certifikáty) na lokálnom PostgreSQL (pravidlá Foundera, členstvo, prestup, licencie, RLS).


## Fázy 4 a 5 – čo pribudlo
- Migrácie `20261114000005_events.sql` a `20261114000006_attendance.sql`: spusti ich v SQL Editore Supabase **po** prvých štyroch, v tomto poradí.
- Organizácia: Podujatia, Prihlášky (aj súhlas domovskej organizácie), Pracovné tímy, Pozície, Pracovné zmeny, Dynamické formuláre (verzované), Dochádzka a certifikáty.
- Dobrovoľník: verejné `/podujatia` (prihlásenie), účet → Prihlášky, Podujatia, Odpracované hodiny, Certifikáty, História.
- Admin: `/admin/events` (iba čítanie).
- Pravidlá: prihlásiť sa dá iba s platnou licenciou; na cudzie podujatie musí súhlasiť domovská organizácia; licencia, ktorá vyprší počas už začatého podujatia, umožní dochádzku dokončiť (zapíše sa do auditu), ale nie nové prihlásenie ani nové zaradenie; dochádzka je iba manuálna (bez QR) a každá oprava vyžaduje dôvod.
- Nové oprávnenia (Founder ich môže meniť): `events.manage`, `forms.manage`, `applications.decide`, `events.consent`, `attendance.write`, `certificates.issue`, systémové `events.read`.


## Fáza 6 a 7 (oznámenia, štatistiky, sťažnosti, pozastavenie, GDPR)
Migrácie spustite v Supabase SQL Editore v poradí po 06:
1. `20261114000007_notifications.sql`
2. `20261114000008_oversight.sql`

Nové env premenné (Vercel): `RESEND_API_KEY`, `EMAIL_FROM` (voliteľné; bez nich e-maily zostanú vo fronte). Cron `/api/cron/daily` teraz aj odosiela e-maily a uplatňuje plánované pozastavenia.
Testy (iba lokálne, nie v Supabase): `supabase/tests/03_oversight.sql`.
Bezpečnosť, GDPR a pilot: `docs/PILOT_A_BEZPECNOST.md`.
