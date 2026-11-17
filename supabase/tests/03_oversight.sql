-- Lokálny test FÁZ 6 a 7. Spustenie PO 01_rules.sql a 02_events.sql:
-- psql -v ON_ERROR_STOP=1 -d sdztest -f 03_oversight.sql   (NIKDY nie v Supabase)
\set QUIET on
drop table if exists t_ok; create table t_ok(name text, ok boolean);
grant all on t_ok to anon, authenticated;
select id as org from organizations where slug = 'test-oz' \gset
select id as org2 from organizations where slug = 'druhe-oz' \gset
select id as eva from events where slug = 'zbierka-a' \gset
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'
\set b1 '00000000-0000-0000-0000-0000000000b1'
\set a1 '00000000-0000-0000-0000-0000000000a1'
\set fo '00000000-0000-0000-0000-00000000000f'

-- ============ OZNÁMENIA ============
insert into t_ok select 'notif: vznikli automaticky (prihlasky/licencie)', (select count(*) > 0 from notifications);
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'notif: pouzivatel vidi iba svoje', (select count(*) > 0 and bool_and(user_id = :'b1') from notifications);
reset role;
select tt.as_user(:'b1');
select mark_notification_read(null);
insert into t_ok select 'notif: oznacit vsetko ako precitane', (select count(*) = 0 from notifications where user_id = :'b1' and read_at is null);
select tt.as_user(null);
set role anon;
insert into t_ok select 'notif: anon nevidi nic', tt.expect_err('permission denied', 'select * from notifications') or (select count(*) = 0 from notifications);
reset role;
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'outbox: nikto nema pristup', (select count(*) = 0 from email_outbox);
insert into t_ok select 'outbox: claim zamietnuty', tt.expect_err('permission denied', 'select * from claim_outbox(5)');
insert into t_ok select 'notify: priame volanie zamietnute', tt.expect_err('permission denied', format($$select notify(%L,'x','y')$$, :'b1'));
reset role;

-- predvolieb: stlmenie druhu
select tt.as_user(:'b1');
select save_notification_prefs(true, array['announcement']);
select tt.as_user(:'c1');
insert into t_ok select 'oznam: koordinator nemoze publikovat', tt.expect_err('FORBIDDEN', $$select publish_announcement('Test oznam','Telo oznamu','all',false,null)$$);
select tt.as_user(:'a1');
select publish_announcement('Dôležitý oznam', 'Telo oznamu pre všetkých', 'all', true, null);
insert into t_ok select 'oznam: stlmeny druh nedorazi', (select count(*) = 0 from notifications where user_id = :'b1' and kind = 'announcement');
insert into t_ok select 'oznam: ostatnym dorazi + e-mail vo fronte',
  (select count(*) = 1 from notifications where user_id = :'c1' and kind = 'announcement')
  and (select count(*) >= 1 from email_outbox where user_id = :'c1' and subject = 'Dôležitý oznam');
select tt.as_user(:'b1');
select save_notification_prefs(false, '{}');
select tt.as_user(:'a1');
select publish_announcement('Druhý oznam', 'Telo druhého oznamu', 'org_staff', true, null);
insert into t_ok select 'oznam: publikum org_staff nezasiahne dobrovolnika', (select count(*) = 0 from notifications where user_id = :'b1' and title = 'Druhý oznam');

-- ============ ŠTATISTIKY A EXPORTY ============
select tt.as_user(:'a1');
insert into t_ok select 'stats: admin vidi centralne', (admin_analytics()->'volunteers'->>'total')::int >= 1;
select tt.as_user(:'c1');
insert into t_ok select 'stats: koordinator nevidi centralne', tt.expect_err('FORBIDDEN', 'select admin_analytics()');
insert into t_ok select 'stats: vlastna org ok', (org_stats(:'org')->>'members') is not null;
insert into t_ok select 'stats: cudzia org zamietnuta', tt.expect_err('FORBIDDEN', format($$select org_stats(%L)$$, :'org2'));
insert into t_ok select 'export: vlastna org ok', jsonb_typeof(export_rows('org_volunteers', :'org')) = 'array';
insert into t_ok select 'export: cudzia org zamietnuta', tt.expect_err('FORBIDDEN', format($$select export_rows('org_attendance', %L)$$, :'org2'));
insert into t_ok select 'export: centralny zamietnuty', tt.expect_err('FORBIDDEN', $$select export_rows('central_events')$$);
insert into t_ok select 'export: auditovany', (select count(*) >= 1 from audit_logs where action = 'export.run');
select tt.as_user(:'a1');
insert into t_ok select 'export: admin centralne ok', jsonb_typeof(export_rows('central_organizations')) = 'array';

-- ============ SŤAŽNOSTI ============
select tt.as_user(:'b1');
select submit_complaint('organization', :'org', null, 'Problém s organizáciou', 'Podrobný popis problému s organizáciou.') as cmp \gset
insert into t_ok select 'sť: cislo SDZ-S', (select complaint_number ~ '^SDZ-S-\d{6}$' from complaints where id = :'cmp');
insert into t_ok select 'sť: kratky popis zamietnuty', tt.expect_err('INVALID_INPUT', format($$select submit_complaint('other',null,null,'Predmet','kratke')$$));
select tt.as_user(:'c1');
set role authenticated;
insert into t_ok select 'sť: organizacia nevidi sť priamo', (select count(*) = 0 from complaints);
reset role;
select tt.as_user(:'c2');
set role authenticated;
insert into t_ok select 'sť: cudzi nevidi', (select count(*) = 0 from complaints);
reset role;
select tt.as_user(:'a1');
set role authenticated;
insert into t_ok select 'sť: admin vidi', (select count(*) = 1 from complaints);
reset role;
select tt.as_user(:'c1');
insert into t_ok select 'sť: org nemoze menit stav', tt.expect_err('FORBIDDEN', format($$select set_complaint_status(%L,'in_review',null)$$, :'cmp'));
insert into t_ok select 'sť: org bez ziadosti nevidi nic', (select count(*) = 0 from list_org_complaints(:'org'));
select tt.as_user(:'a1');
select set_complaint_status(:'cmp', 'in_review', null);
insert into t_ok select 'sť: uzavretie bez dôvodu zamietnuté', tt.expect_err('REASON_REQUIRED', format($$select set_complaint_status(%L,'resolved',null)$$, :'cmp'));
select request_statement(:'cmp', :'org');
insert into t_ok select 'sť: duplicitna ziadost o vyjadrenie', tt.expect_err('ALREADY_EXISTS', format($$select request_statement(%L,%L)$$, :'cmp', :'org'));
select add_complaint_message(:'cmp', 'Interná poznámka', true);
select add_complaint_message(:'cmp', 'Verejná správa pre podávateľa', false);
select tt.as_user(:'c1');
insert into t_ok select 'sť: org vidi obsah bez podavatela', (select count(*) = 1 and bool_and(subject = 'Problém s organizáciou') from list_org_complaints(:'org'))
  and not exists (select 1 from information_schema.columns where table_name = 'complaint_statements' and column_name = 'submitter_id');
insert into t_ok select 'sť: cudzia org nemoze', tt.expect_err('FORBIDDEN', format($$select list_org_complaints(%L)$$, :'org2'));
select answer_statement((select statement_id from list_org_complaints(:'org')), 'Vyjadrenie organizácie k problému.');
insert into t_ok select 'sť: vyjadrenie raz', tt.expect_err('INVALID_STATE', format($$select answer_statement(%L,'Druhe vyjadrenie org.')$$, (select statement_id from list_org_complaints(:'org'))));
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'sť: podavatel nevidi internu poznamku', (select count(*) = 1 from complaint_messages where body like 'Verejn%') and (select count(*) = 0 from complaint_messages where internal);
reset role;
insert into t_ok select 'sť: podavatel nemoze pisat interne', tt.expect_err('FORBIDDEN', format($$select add_complaint_message(%L,'x',true)$$, :'cmp'));
insert into t_ok select 'sť: podavatel dostal oznamenie', (select count(*) >= 1 from notifications where user_id = :'b1' and kind like 'complaint.%');
select tt.as_user(:'a1');
select set_complaint_status(:'cmp', 'resolved', 'Vyriešené s organizáciou.');
insert into t_ok select 'sť: uzavreta sa nedá meniť', tt.expect_err('INVALID_STATE', format($$select set_complaint_status(%L,'in_review',null)$$, :'cmp'));
insert into t_ok select 'sť: história nemenná', tt.expect_err('IMMUTABLE', $$update complaint_history set event = 'x'$$);
-- vlastnú sťažnosť nemožno riešiť
select submit_complaint('sdz', null, null, 'Moja vlastná', 'Sťažnosť podaná správcom samotným.') as cmp2 \gset
insert into t_ok select 'sť: vlastnú nemožno riešiť', tt.expect_err('FORBIDDEN', format($$select set_complaint_status(%L,'in_review',null)$$, :'cmp2'));
-- limit 5/24 h
select tt.as_user(:'b1');
select submit_complaint('other', null, null, 'Predmet ' || g, 'Dlhší popis sťažnosti číslo ' || g) from generate_series(1, 4) g;
insert into t_ok select 'sť: limit 5 za 24 h', tt.expect_err('RATE_LIMIT', $$select submit_complaint('other',null,null,'Predmet X','Dlhší popis sťažnosti X')$$);
select withdraw_complaint(id) from complaints where subject = 'Predmet 1';
insert into t_ok select 'sť: stiahnutie', (select status = 'withdrawn' from complaints where subject = 'Predmet 1');

-- ============ POZASTAVENIE ORGANIZÁCIE ============
select tt.as_user(:'c1');
insert into t_ok select 'susp: koordinator nemoze', tt.expect_err('FORBIDDEN', format($$select suspend_organization(%L,'Dlhší dôvod pozastavenia')$$, :'org'));
select tt.as_user(:'fo');
insert into t_ok select 'susp: kratky dôvod', tt.expect_err('REASON_REQUIRED', format($$select suspend_organization(%L,'x')$$, :'org'));
select suspend_organization(:'org', 'Porušenie pravidiel SDZ – test');
insert into t_ok select 'susp: org je suspended', (select status = 'suspended' from organizations where id = :'org');
insert into t_ok select 'susp: duplicita zamietnuta', tt.expect_err('INVALID_STATE', format($$select suspend_organization(%L,'Dlhší dôvod pozastavenia')$$, :'org'));
select tt.as_user(null);
set role anon;
insert into t_ok select 'susp: verejne podujatia skryte', (select count(*) = 0 from events where organization_id = :'org');
reset role;
select tt.as_user(:'c1');
insert into t_ok select 'susp: nove podujatie zablokovane', tt.expect_err('ORG_NOT_AVAILABLE',
  format($$select save_event(null,%L,'x-susp','Nové podujatie','', '', null, now()+interval '5 days', now()+interval '6 days', 1, null, null, null, false, false, null)$$, :'org'));
insert into t_ok select 'susp: org vidi vlastne pozastavenie', (select count(*) = 1 from (select 1 from organization_suspensions where organization_id = :'org') x);
insert into t_ok select 'susp: notifikacia majitelovi', (select count(*) >= 1 from notifications where user_id = :'c1' and kind = 'organization.suspended');
select tt.as_user(:'fo');
select lift_suspension(:'org', 'Napravené');
insert into t_ok select 'susp: obnovenie -> approved', (select status = 'approved' from organizations where id = :'org');
select tt.as_user(null);
set role anon;
insert into t_ok select 'susp: podujatia znovu verejne', (select count(*) >= 1 from events where organization_id = :'org');
reset role;
-- plánované
select tt.as_user(:'fo');
select suspend_organization(:'org', 'Plánované pozastavenie – test', now() + interval '3 days', now() + interval '10 days');
insert into t_ok select 'susp: planovane nemeni stav', (select status = 'approved' from organizations where id = :'org');
update organization_suspensions set starts_at = now() - interval '1 hour' where organization_id = :'org' and status = 'scheduled';
select apply_suspensions();
insert into t_ok select 'susp: cron zacne', (select status = 'suspended' from organizations where id = :'org');
update organization_suspensions set ends_at = now() - interval '1 minute' where organization_id = :'org' and status = 'active';
select apply_suspensions();
insert into t_ok select 'susp: cron skonci', (select status = 'approved' from organizations where id = :'org')
  and exists (select 1 from organization_suspensions where organization_id = :'org' and status = 'expired');
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'susp: priamy zapis zamietnuty', tt.expect_err('permission denied', $$insert into organization_suspensions(organization_id,reason,created_by) values (gen_random_uuid(),'xxxxxxxxxxx',gen_random_uuid())$$)
  or tt.expect_err('row-level security', $$insert into organization_suspensions(organization_id,reason,created_by) values (gen_random_uuid(),'xxxxxxxxxxx',gen_random_uuid())$$);
reset role;

-- ============ GDPR ============
select tt.as_user(:'b1');
select request_data_action('access', 'Chcem kópiu údajov') as dr \gset
insert into t_ok select 'gdpr: duplicitna ziadost', tt.expect_err('ALREADY_EXISTS', $$select request_data_action('access', null)$$);
insert into t_ok select 'gdpr: vlastnú nemôže vybaviť', tt.expect_err('FORBIDDEN', format($$select handle_data_request(%L,'done','Hotovo vybavené')$$, :'dr'));
select export_my_data() as ex \gset
insert into t_ok select 'gdpr: export obsahuje profil', (:'ex'::jsonb->'profile'->>'email') = 'vol@x.sk' and :'ex'::jsonb ? 'licenses';
insert into t_ok select 'gdpr: export auditovany', (select count(*) >= 1 from audit_logs where action = 'gdpr.export');
select tt.as_user(:'c1');
set role authenticated;
insert into t_ok select 'gdpr: cudzia ziadost nevidno', (select count(*) = 0 from data_requests);
reset role;
select tt.as_user(:'a1');
select handle_data_request(:'dr', 'done', 'Údaje boli poskytnuté e-mailom.');
insert into t_ok select 'gdpr: vybavenie + notifikacia', (select status = 'done' from data_requests where id = :'dr')
  and (select count(*) >= 1 from notifications where user_id = :'b1' and kind = 'gdpr.done');

-- ============ DENNÁ ÚDRŽBA ============
select tt.as_user(null);
insert into t_ok select 'cron: run_daily_maintenance bezi', (run_daily_maintenance() ? 'reminders');

select name, ok from t_ok where not ok;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t_ok;
