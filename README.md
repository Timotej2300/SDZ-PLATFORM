# SDZ – Slovenský dobrovoľnícky zväz (FÁZY 1–3)

Next.js (App Router) + Supabase + Vercel. Stav: FÁZA 1 (základy), 2 (organizácie), 3 (dobrovoľníci) hotové.

## Nastavenie
1. Supabase projekt (región EÚ). Spusti migrácie z `supabase/migrations/` v poradí (SQL Editor alebo `supabase db push`).
2. Supabase → Auth: povoliť e-mail potvrdenie, MFA (TOTP), Site URL a Redirect URL `https://<domena>/auth/callback`; minimálna dĺžka hesla 12.
3. `cp .env.example .env.local` a doplniť hodnoty (service role kľúč iba na serveri).
4. Prvý Founder: zaregistruj účet, over e-mail, potom v SQL Editore: `select public.founder_bootstrap('tvoj@email.sk');`
5. `npm install && npm run dev`. Vercel: pridať env premenné vrátane `CRON_SECRET`.

## Testy
`supabase/tests/00_stub.sql` + migrácie + `01_rules.sql` na lokálnom PostgreSQL (pravidlá Foundera, členstvo, prestup, licencie, RLS).
