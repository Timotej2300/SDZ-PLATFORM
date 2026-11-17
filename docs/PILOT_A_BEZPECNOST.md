# Fáza 7 – bezpečnosť, GDPR a pilot

## Pozastavenie organizácie (účinky)
- Nové podujatia, nové prihlášky a registrácie do organizácie sú zablokované (`ORG_NOT_AVAILABLE`).
- Jej podujatia zmiznú z verejných zoznamov (verejný výpis vyžaduje schválenú organizáciu).
- Už začaté podujatia môžu dokončiť dochádzku; nové zaradenia nie.
- Tím organizácie má prístup na čítanie, história a údaje zostávajú.
- Pozastaviť/obnoviť môže iba rola s `orgs.suspend` (president, secretary_general, Founder), s dôvodom ≥ 10 znakov, zapísaným do auditu. Možno naplánovať začiatok aj koniec (cron raz denne).

## Sťažnosti
- Číslo `SDZ-S-000001`. Podávateľ vidí iba svoju sťažnosť a verejné správy. Max. 5 podaní za 24 h.
- Organizácia vidí iba obsah (nie totožnosť) a len ak si SDZ vyžiada vyjadrenie (lehota 14 dní, odpoveď sa dá odoslať raz).
- Vlastnú sťažnosť nemôže riešiť ten istý človek. História a správy sú nemenné.

## GDPR
- Okamžitý export vlastných údajov (JSON), auditovaný.
- Žiadosti (prístup, oprava, vymazanie, obmedzenie, námietka) s lehotou 30 dní; vybavuje rola `gdpr.manage`, nie žiadateľ sám.
- Vymazanie sa posudzuje ručne: licenčná história, auditné záznamy a odpracované hodiny sa uchovávajú zo zákonných/ochranných dôvodov, údaje sa obmedzia. Uchováva sa iba rok narodenia.
- Retencia: prečítané oznámenia 12 mesiacov, e-maily vo fronte 90 dní (cron).

## Bezpečnostný checklist pred pilotom
1. Všetky zápisy idú cez SECURITY DEFINER RPC, tabuľky majú iba SELECT politiky (overené testami 01–03).
2. `sb_secret`/service_role kľúč iba vo Vercel env, nikdy v gite; `.env.local` v `.gitignore`.
3. Email provider v Supabase zapnutý; potvrdenie e-mailu zapnuté; vlastné SMTP/Resend doména overená.
4. Founder a centrálne role majú zapnuté TOTP (AAL2).
5. `CRON_SECRET` nastavený; Vercel Cron volá `/api/cron/daily`.
6. Supabase Advisors (Security) bez varovaní o tabuľkách bez RLS.
7. Zálohy databázy zapnuté; vyskúšané obnovenie.
8. Testovacie SQL (`supabase/tests/*`) sa NIKDY nespúšťajú v produkčnej databáze.

## Plán pilotu (6 týždňov)
- T1: 2–3 pilotné organizácie, ručné schválenie, školenie koordinátorov.
- T2–3: pozvánky dobrovoľníkom, prvé podujatia, dochádzka a certifikáty.
- T4: kontrola sťažností, oznámení a e-mailov, oprava chýb.
- T5: kontrola auditu, výkonu, GDPR žiadostí (skúšobná žiadosť o export).
- T6: vyhodnotenie, rozhodnutie o rozšírení; až potom FÁZA 8 (regióny, ocenenia).
