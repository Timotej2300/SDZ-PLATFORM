-- Lokálny test FÁZ 4 a 5. Spustenie PO 01_rules.sql (využíva jeho organizácie a dobrovoľníka):
-- psql -v ON_ERROR_STOP=1 -d sdztest -f 02_events.sql
\set QUIET on
drop table if exists t_ok; create table t_ok(name text, ok boolean);
grant all on t_ok to anon, authenticated;

select id as org from organizations where slug = 'test-oz' \gset
select id as org2 from organizations where slug = 'druhe-oz' \gset
select id as vol from volunteers \gset
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'
\set b1 '00000000-0000-0000-0000-0000000000b1'
\set fo '00000000-0000-0000-0000-00000000000f'

-- člen vidí organizácie, v ktorých je členom, cudziu nie
select tt.as_user(:'c1');
select create_organization('Tretie OZ', 'nonprofit', 'tretie-oz');
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'rls: clen vidi iba svoje organizacie', (select count(*) = 2 and bool_and(slug in ('test-oz', 'druhe-oz')) from organizations);
reset role;

-- ============ FORMULÁR (verzie) ============
select tt.as_user(:'c1');
insert into t_ok select 'forma: neplatne pole zamietnute',
  tt.expect_err('FORM_INVALID', format($$select save_form(null,%L,'F','', '[{"id":"X","label":"a","type":"text"}]'::jsonb)$$, :'org'));
select save_form(null, :'org', 'Prihlaska', null,
  '[{"id":"motivacia","label":"Motivácia","type":"textarea","required":true},{"id":"velkost","label":"Veľkosť","type":"select","required":false,"options":["S","M","L"]}]'::jsonb) as form1 \gset
select id as fv1 from form_versions where form_id = :'form1' and version = 1 \gset
select save_form(:'form1', :'org', 'Prihlaska', null,
  '[{"id":"motivacia","label":"Motivácia","type":"textarea","required":true}]'::jsonb);
insert into t_ok select 'forma: nova verzia, stara nemenna',
  (select count(*) = 2 from form_versions where form_id = :'form1')
  and tt.expect_err('IMMUTABLE', format($$update form_versions set fields='[]'::jsonb where id=%L$$, :'fv1'));
select tt.as_user(:'c2');
insert into t_ok select 'forma: cudzia org nemoze', tt.expect_err('FORBIDDEN', format($$select save_form(%L,%L,'X',null,'[]'::jsonb)$$, :'form1', :'org'));

-- ============ PODUJATIE A (cudzie pre dobrovoľníka: domovská org = org2) ============
select tt.as_user(:'c1');
select save_event(null, :'org', 'zbierka-a', 'Zbierka A', 'Popis', 'Bratislava', null,
  now() + interval '10 days', now() + interval '11 days', 1, null, null, null, false, false, :'fv1') as eva \gset
select tt.as_user(null);
set role anon;
insert into t_ok select 'event: anon nevidi draft', (select count(*) = 0 from events);
reset role;
select tt.as_user(:'b1');
insert into t_ok select 'event: prihlaska na draft zamietnuta', tt.expect_err('EVENT_CLOSED', format($$select apply_to_event(%L,'{"motivacia":"x"}'::jsonb,null)$$, :'eva'));
select tt.as_user(:'c1');
select set_event_published(:'eva', true);
select tt.as_user(null);
set role anon;
insert into t_ok select 'event: anon vidi publikovane', (select count(*) = 1 from events);
reset role;
select tt.as_user(:'c2');
insert into t_ok select 'event: cudzia org nemoze publikovat/menit', tt.expect_err('FORBIDDEN', format($$select set_event_published(%L,false)$$, :'eva'));
set role authenticated;
insert into t_ok select 'event: priamy insert zamietnuty', tt.expect_err('permission denied',
  format($$insert into events(organization_id,slug,title,starts_at,ends_at) values (%L,'x-x','Xxx',now(),now()+interval '1 day')$$, :'org'));
reset role;

-- prihláška
select tt.as_user(:'b1');
insert into t_ok select 'prihlaska: chyba povinne pole', tt.expect_err('FORM_INCOMPLETE', format($$select apply_to_event(%L,'{}'::jsonb,null)$$, :'eva'));
select apply_to_event(:'eva', '{"motivacia":"Chcem pomáhať","cudzie":"x"}'::jsonb, 'Ahoj') as appa \gset
insert into t_ok select 'prihlaska: ulozena, cudzie kluce zahodene, suhlas pending',
  (select status = 'submitted' and home_org_consent_status = 'pending' and home_org_id = :'org2'
          and answers = '{"motivacia":"Chcem pomáhať"}'::jsonb from applications where id = :'appa');
insert into t_ok select 'prihlaska: duplicita zamietnuta', tt.expect_err('ALREADY_APPLIED', format($$select apply_to_event(%L,'{"motivacia":"x"}'::jsonb,null)$$, :'eva'));
set role authenticated;
insert into t_ok select 'prihlaska: priama uprava zamietnuta', tt.expect_err('', format($$update applications set status='approved' where id=%L$$, :'appa'));
reset role;

-- súhlas domovskej organizácie
select tt.as_user(:'c1');
insert into t_ok select 'suhlas: organizator nemoze zacat kontrolu bez suhlasu', tt.expect_err('CONSENT_REQUIRED', format($$select review_application(%L,'start_review')$$, :'appa'));
insert into t_ok select 'suhlas: organizator nemoze suhlasit za domovsku org', tt.expect_err('FORBIDDEN', format($$select decide_home_consent(%L,'grant')$$, :'appa'));
set role authenticated;
insert into t_ok select 'rls: organizator vidi prihlasku svojho podujatia', (select count(*) = 1 from applications);
reset role;
select tt.as_user(:'c2');
set role authenticated;
insert into t_ok select 'rls: domovska org nevidi obsah prihlasky (iba cez funkciu)', (select count(*) = 0 from applications);
reset role;
insert into t_ok select 'suhlas: domovska org vidi ziadost', (select count(*) = 1 and bool_and(consent = 'pending') from list_consent_requests(:'org2'));
insert into t_ok select 'suhlas: zamietnutie vyzaduje dovod', tt.expect_err('REASON_REQUIRED', format($$select decide_home_consent(%L,'deny')$$, :'appa'));
select decide_home_consent(:'appa', 'grant');
select tt.as_user(:'c1');
select review_application(:'appa', 'start_review');
insert into t_ok select 'prihlaska: zamietnutie vyzaduje dovod', tt.expect_err('REASON_REQUIRED', format($$select review_application(%L,'reject')$$, :'appa'));
select review_application(:'appa', 'approve');
insert into t_ok select 'prihlaska: schvalena', (select status = 'approved' from applications where id = :'appa');

-- uzamknutie formulára
select tt.as_user(:'c1');
insert into t_ok select 'event: forma sa po prihlaskach nemeni', tt.expect_err('FORM_LOCKED',
  format($$select save_event(%L,%L,null,'Zbierka A',null,null,null,now()+interval '10 days',now()+interval '11 days',1,null,null,null,false,false,null)$$, :'eva', :'org'));

-- zaradenie
select save_team(null, :'eva', 'Tím 1', null, 1, null) as team1 \gset
select save_position(null, :'eva', :'team1', 'Informátor', null, 1) as pos1 \gset
select save_shift(null, :'eva', :'team1', :'pos1', now() + interval '10 days', now() + interval '10 days 4 hours', 1, null) as sh1 \gset
insert into t_ok select 'zmena: mimo casu podujatia zamietnuta', tt.expect_err('INVALID_TIME',
  format($$select save_shift(null,%L,null,null,now(),now()+interval '1 hour',1,null)$$, :'eva'));
select assign_application(:'appa', :'team1', :'pos1', array[:'sh1']::uuid[]);
insert into t_ok select 'zaradenie: assigned + zmena', (select status = 'assigned' and team_id = :'team1' from applications where id = :'appa')
  and (select count(*) = 1 from shift_assignments);
insert into t_ok select 'zaradenie: pozicia/tim v pouziti sa nedaju zmazat', tt.expect_err('IN_USE', format($$select delete_event_item('team',%L)$$, :'team1'));
insert into t_ok select 'event: zmazanie s prihlaskami zamietnute', tt.expect_err('HAS_APPLICATIONS', format($$select delete_event(%L)$$, :'eva'));

-- vek
select save_event(null, :'org', 'tricet-plus', 'Tricet plus', null, null, null,
  now() + interval '20 days', now() + interval '21 days', null, 40, null, null, false, false, null) as evage \gset
select set_event_published(:'evage', true);
select tt.as_user(:'b1');
insert into t_ok select 'vek: pod minimum zamietnuty', tt.expect_err('AGE_NOT_ALLOWED', format($$select apply_to_event(%L,'{}'::jsonb,null)$$, :'evage'));

-- zrušenie podujatia zruší prihlášky
select tt.as_user(:'c1');
insert into t_ok select 'event: zrusenie vyzaduje dovod', tt.expect_err('REASON_REQUIRED', format($$select cancel_event(%L,'')$$, :'eva'));
select cancel_event(:'eva', 'Zlé počasie');
insert into t_ok select 'event: zrusenie zrusilo prihlasky', (select status = 'cancelled' from applications where id = :'appa');
select tt.as_user(:'b1');
insert into t_ok select 'event: na zrusene sa nedá prihlasit', tt.expect_err('EVENT_CLOSED', format($$select apply_to_event(%L,'{"motivacia":"x"}'::jsonb,null)$$, :'eva'));

-- ============ PODUJATIE B (vlastná org dobrovoľníka, prebieha) ============
select tt.as_user(:'c2');
select save_event(null, :'org2', 'prebiehajuce-b', 'Prebiehajúce B', null, null, null,
  now() - interval '2 hours', now() + interval '2 hours', null, null, null, null, false, false, null) as evb \gset
select set_event_published(:'evb', true);
select save_shift(null, :'evb', null, null, now() - interval '2 hours', now() + interval '110 minutes', null, null) as shb \gset
select tt.as_user(:'b1');
select apply_to_event(:'evb', '{}'::jsonb, null) as appb \gset
insert into t_ok select 'prihlaska: vlastna org = suhlas nie je potrebny', (select home_org_consent_status = 'not_required' from applications where id = :'appb');
select tt.as_user(:'c2');
insert into t_ok select 'zaradenie: pred schvalenim nejde', tt.expect_err('INVALID_STATE', format($$select assign_application(%L,null,null,array[%L]::uuid[])$$, :'appb', :'shb'));
select review_application(:'appb', 'approve');
select assign_application(:'appb', null, null, array[:'shb']::uuid[]);

-- dochádzka
select tt.as_user(:'c1');
insert into t_ok select 'dochadzka: cudzia organizacia (org1) nemoze', tt.expect_err('FORBIDDEN', format($$select record_attendance(%L,%L,now()-interval '1 hour',null)$$, :'shb', :'vol'));
select tt.as_user(:'c2');
insert into t_ok select 'dochadzka: buducnost zamietnuta', tt.expect_err('INVALID_TIME', format($$select record_attendance(%L,%L,now()+interval '1 hour',null)$$, :'shb', :'vol'));
select record_attendance(:'shb', :'vol', now() - interval '90 minutes', null) as att \gset
insert into t_ok select 'dochadzka: duplicita zamietnuta', tt.expect_err('ATTENDANCE_EXISTS', format($$select record_attendance(%L,%L,now()-interval '1 hour',null)$$, :'shb', :'vol'));
select record_checkout(:'att', now() - interval '30 minutes');
insert into t_ok select 'hodiny: 1 hodina', (select hours = 1.00 from volunteer_hours where attendance_id = :'att');
insert into t_ok select 'dochadzka: oprava bez dovodu zamietnuta', tt.expect_err('REASON_REQUIRED', format($$select correct_attendance(%L,now()-interval '90 minutes',now()-interval '15 minutes','')$$, :'att'));
select correct_attendance(:'att', now() - interval '90 minutes', now() - interval '15 minutes', 'Odchod bol neskôr');
insert into t_ok select 'dochadzka: oprava zapisana s povodnou hodnotou', (select count(*) = 1 from attendance_corrections where attendance_id = :'att' and old_value ? 'checked_out_at' and new_value ? 'checked_out_at')
  and (select hours = 1.25 from volunteer_hours where attendance_id = :'att');
reset role;
insert into t_ok select 'dochadzka: priame mazanie zamietnute', tt.expect_err('IMMUTABLE', format($$delete from attendance_records where id=%L$$, :'att'));
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'rls: dobrovolnik vidi svoju dochadzku a hodiny', (select count(*) = 1 from attendance_records) and (select count(*) = 1 from volunteer_hours);
insert into t_ok select 'rls: dobrovolnik nezapise dochadzku priamo', tt.expect_err('permission denied', format($$insert into attendance_records(event_id,shift_id,volunteer_id,checked_in_at,recorded_by) values (%L,%L,%L,now(),%L)$$, :'evb', :'shb', :'vol', :'b1'));
reset role;
select tt.as_user(:'c1');
set role authenticated;
insert into t_ok select 'rls: cudzia org nevidi dochadzku', (select count(*) = 0 from attendance_records);
reset role;

-- certifikát
select tt.as_user(:'c2');
insert into t_ok select 'certifikat: pred koncom podujatia zamietnuty', tt.expect_err('EVENT_NOT_ENDED', format($$select issue_certificate(%L,%L)$$, :'evb', :'vol'));
reset role;
update events set starts_at = now() - interval '5 hours', ends_at = now() - interval '1 hour' where id = :'evb';
select tt.as_user(:'c2');
select issue_certificate(:'evb', :'vol') as cert \gset
insert into t_ok select 'certifikat: cislo a hodiny', (select certificate_number ~ '^SDZ-C-\d{6}$' and hours = 1.25 from volunteer_certificates where id = :'cert');
insert into t_ok select 'certifikat: duplicita zamietnuta', tt.expect_err('DUPLICATE', format($$select issue_certificate(%L,%L)$$, :'evb', :'vol'));
insert into t_ok select 'certifikat: zrusenie vyzaduje dovod', tt.expect_err('REASON_REQUIRED', format($$select revoke_certificate(%L,'')$$, :'cert'));
select revoke_certificate(:'cert', 'Omyl pri zápise');
insert into t_ok select 'certifikat: zruseny je nemenny', tt.expect_err('INVALID_STATE', format($$select revoke_certificate(%L,'znova')$$, :'cert'));
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'rls: dobrovolnik vidi svoj certifikat', (select count(*) = 1 from volunteer_certificates);
reset role;

-- ============ KAPACITA (druhý dobrovoľník) ============
reset role;
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000b2','vol2@x.sk','{"first_name":"W","last_name":"W","birth_year":1990}',now());
begin;
select set_config('sdz.fn', '1', true);
insert into volunteers(profile_id, registration_number) values ('00000000-0000-0000-0000-0000000000b2', 'SDZ-1111-2222-3333');
insert into organization_memberships(volunteer_id, organization_id) select id, :'org2' from volunteers where registration_number = 'SDZ-1111-2222-3333';
select _issue_license(id, null, 'issued') from volunteers where registration_number = 'SDZ-1111-2222-3333';
commit;
\set b2 '00000000-0000-0000-0000-0000000000b2'
select tt.as_user(:'c2');
select save_event(null, :'org2', 'kapacita-f', 'Kapacita F', null, null, null,
  now() + interval '7 days', now() + interval '8 days', 1, null, null, null, false, false, null) as evf \gset
select set_event_published(:'evf', true);
select tt.as_user(:'b1');
select apply_to_event(:'evf', '{}'::jsonb, null) as appf1 \gset
select tt.as_user(:'b2');
select apply_to_event(:'evf', '{}'::jsonb, null) as appf2 \gset
select tt.as_user(:'c2');
select review_application(:'appf1', 'approve');
insert into t_ok select 'kapacita: druhe schvalenie zamietnute', tt.expect_err('CAPACITY_FULL', format($$select review_application(%L,'approve')$$, :'appf2'));

-- ============ PODUJATIE C: licencia expirovala počas už začatého podujatia ============
select tt.as_user(:'c2');
select save_event(null, :'org2', 'zacate-c', 'Začaté C', null, null, null,
  now() - interval '3 days', now() + interval '1 day', null, null, null, null, false, false, null) as evc \gset
select set_event_published(:'evc', true);
select save_shift(null, :'evc', null, null, now() - interval '2 days', now() - interval '2 days' + interval '4 hours', null, null) as shc \gset
select tt.as_user(:'b1');
select apply_to_event(:'evc', '{}'::jsonb, null) as appc \gset
select tt.as_user(:'c2');
select review_application(:'appc', 'approve');
select save_shift(null, :'evc', null, null, now() - interval '1 day', now() - interval '1 day' + interval '2 hours', null, null) as shc2 \gset
select assign_application(:'appc', null, null, array[:'shc', :'shc2']::uuid[]);
-- licencia expiruje (platila na začiatku podujatia)
reset role;
alter table volunteer_licenses disable trigger licenses_guard;
update volunteer_licenses set issued_on = current_date - 100, expires_on = current_date - 1 where status = 'active';
alter table volunteer_licenses enable trigger licenses_guard;
select tt.as_user(:'c2');
select record_attendance(:'shc', :'vol', now() - interval '2 days', now() - interval '2 days' + interval '2 hours');
insert into t_ok select 'licencia: dochadzka pocas zaciateho podujatia povolena + audit vynimky',
  (select count(*) >= 1 from audit_logs where action = 'license.exception.ongoing_event');
select save_event(null, :'org2', 'nove-d', 'Nové D', null, null, null,
  now() + interval '5 days', now() + interval '6 days', null, null, null, null, false, false, null) as evd \gset
select set_event_published(:'evd', true);
select tt.as_user(:'b1');
insert into t_ok select 'licencia: nova prihlaska s expirovanou licenciou zamietnuta', tt.expect_err('LICENSE_REQUIRED', format($$select apply_to_event(%L,'{}'::jsonb,null)$$, :'evd'));
select tt.as_user(:'c2');
select save_shift(null, :'evc', null, null, now() - interval '1 day' + interval '3 hours', now() - interval '1 day' + interval '5 hours', null, null) as shc3 \gset
insert into t_ok select 'licencia: nove pridelenie s expirovanou licenciou zamietnute', tt.expect_err('LICENSE_REQUIRED',
  format($$select assign_application(%L,null,null,array[%L,%L,%L]::uuid[])$$, :'appc', :'shc', :'shc2', :'shc3'));

-- pozastavená organizácia: nové podujatia zakázané, prebiehajúce ide
begin;
select set_config('sdz.fn', '1', true);
update organizations set status = 'suspended' where id = :'org2';
commit;
select tt.as_user(:'c2');
insert into t_ok select 'pozastavena org: nove podujatie zakazane', tt.expect_err('ORG_NOT_AVAILABLE',
  format($$select save_event(null,%L,'x-y','Xyz',null,null,null,now()+interval '1 day',now()+interval '2 days',null,null,null,null,false,false,null)$$, :'org2'));
select record_attendance(:'shc2', :'vol', now() - interval '1 day', now() - interval '1 day' + interval '1 hour') as attc2 \gset
insert into t_ok select 'pozastavena org: dochadzka prebiehajuceho podujatia ide', (select count(*) = 1 from attendance_records where id = :'attc2');
select tt.as_user(null);
select tt.as_user(null);
set role anon;
insert into t_ok select 'pozastavena org: anon nevidi jej podujatia', (select count(*) = 0 from events where organization_id = :'org2');
reset role;

\set QUIET off
select name, case when ok then 'OK' else 'FAIL' end as vysledok from t_ok order by ctid;
select count(*) filter (where not ok) as zlyhania, count(*) as spolu from t_ok;
