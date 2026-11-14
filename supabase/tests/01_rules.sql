-- Lokálny test pravidiel. Spustenie: psql -v ON_ERROR_STOP=1 -f 01_rules.sql (po stub + migráciách)
\set QUIET on
create schema if not exists tt; grant usage on schema tt to anon, authenticated;
drop table if exists t_ok; create table t_ok(name text, ok boolean);
create or replace function tt.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); end $$;
create or replace function tt.expect_err(code text, sql text) returns boolean language plpgsql as $$
begin execute sql; return false;
exception when others then return sqlerrm like '%' || code || '%'; end $$;

grant all on t_ok to anon, authenticated;
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000f','founder@x.sk','{"first_name":"F","last_name":"F","birth_year":1980}',now()),
 ('00000000-0000-0000-0000-0000000000a1','admin@x.sk','{"first_name":"A","last_name":"A","birth_year":1980}',now()),
 ('00000000-0000-0000-0000-0000000000c1','coord@x.sk','{"first_name":"C","last_name":"C","birth_year":1985}',now()),
 ('00000000-0000-0000-0000-0000000000c2','coord2@x.sk','{"first_name":"D","last_name":"D","birth_year":1985}',now()),
 ('00000000-0000-0000-0000-0000000000b1','vol@x.sk','{"first_name":"V","last_name":"V","birth_year":1995}',now());

select founder_bootstrap('founder@x.sk');
insert into t_ok select 'founder bootstrap', is_founder('00000000-0000-0000-0000-00000000000f');

-- admin nemôže získať rolu Founder ani sa sám povýšiť
select tt.as_user('00000000-0000-0000-0000-00000000000f');
select grant_role('admin@x.sk','admin','system');
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
insert into t_ok select 'admin: grant founder zamietnuty',
  tt.expect_err('FOUNDER_PROTECTED', $$select grant_role('coord@x.sk','founder','system')$$);
insert into t_ok select 'admin: grant admin zamietnuty (len founder)',
  tt.expect_err('FORBIDDEN', $$select grant_role('coord@x.sk','admin','system')$$);
set role authenticated;
insert into t_ok select 'admin: priamy insert do user_roles zamietnuty',
  tt.expect_err('', $$insert into user_roles(user_id,role_id,scope_type) select '00000000-0000-0000-0000-0000000000a1', id, 'system' from roles where key='founder'$$);
reset role;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
insert into t_ok select 'admin: revoke founder zamietnuty',
  tt.expect_err('FOUNDER_PROTECTED', format($$select revoke_role(%L)$$, (select ur.id from user_roles ur join roles r on r.id=ur.role_id where r.key='founder')));

-- audit je nemenný
insert into t_ok select 'audit immutable', tt.expect_err('AUDIT_IMMUTABLE', 'update audit_logs set action=''x''');

-- organizácia
select tt.as_user('00000000-0000-0000-0000-0000000000c1');
select create_organization('Test OZ','civic_association','test-oz') as org \gset
update organizations set region_id=(select id from regions limit 1), address='Ulica 1', contact_email='o@x.sk', description='Popis' where id=:'org';
insert into t_ok select 'org: status menit nejde', tt.expect_err('FORBIDDEN', format('update organizations set status=%L where id=%L','approved',:'org'));
insert into t_ok select 'org: submit bez dokumentov zamietnuty', tt.expect_err('ORG_NO_DOCUMENTS', format('select submit_organization(%L)', :'org'));
insert into organization_documents(organization_id,kind,file_name,storage_path,size_bytes,uploaded_by)
 values (:'org','registration','a.pdf', :'org' || '/a.pdf', 10, '00000000-0000-0000-0000-0000000000c1');
select submit_organization(:'org');
insert into t_ok select 'org: submitted', (select status='submitted' from organizations where id=:'org');
insert into t_ok select 'org: koordinator bez prava schvalit', tt.expect_err('FORBIDDEN', format('select review_organization(%L,%L)', :'org','approve'));

select tt.as_user('00000000-0000-0000-0000-00000000000f');
select review_organization(:'org','approve');
insert into t_ok select 'org: approved + cislo', (select status='approved' and org_number ~ '^SDZ-O-\d{5}$' from organizations where id=:'org');

-- druhá organizácia
select tt.as_user('00000000-0000-0000-0000-0000000000c2');
select create_organization('Druhe OZ','nonprofit','druhe-oz') as org2 \gset
update organizations set region_id=(select id from regions limit 1), address='U 2', contact_email='p@x.sk', description='P' where id=:'org2';
insert into organization_documents(organization_id,kind,file_name,storage_path,size_bytes,uploaded_by)
 values (:'org2','registration','b.pdf', :'org2' || '/b.pdf', 10, '00000000-0000-0000-0000-0000000000c2');
select submit_organization(:'org2');
select tt.as_user('00000000-0000-0000-0000-00000000000f');
select review_organization(:'org2','approve');

-- pozvánka -> registrácia -> schválenie
select tt.as_user('00000000-0000-0000-0000-0000000000c1');
select create_invitation(:'org','vol@x.sk',encode(extensions.digest('tok1','sha256'),'hex'));
insert into t_ok select 'invite: lookup', lookup_invitation(encode(extensions.digest('tok1','sha256'),'hex')) is not null;
select tt.as_user('00000000-0000-0000-0000-0000000000b1');
select claim_invitation(encode(extensions.digest('tok1','sha256'),'hex')) as reg \gset
insert into t_ok select 'invite: pouzita', lookup_invitation(encode(extensions.digest('tok1','sha256'),'hex')) is null;
select tt.as_user('00000000-0000-0000-0000-00000000000f');
select review_volunteer_registration(:'reg','approve');
select tt.as_user('00000000-0000-0000-0000-0000000000b1');
select registration_number as rn from volunteers \gset
insert into t_ok select 'vol: reg cislo + licencia + clenstvo',
  :'rn' ~ '^SDZ-\d{4}-\d{4}-\d{4}$'
  and (select count(*)=1 from volunteer_licenses)
  and (select home_organization_id=:'org' from volunteers);
set role authenticated;
insert into t_ok select 'vol: reg cislo sa neda zmenit', tt.expect_err('IMMUTABLE', format('update volunteers set registration_number=%L','SDZ-0000-0000-0000'));
insert into t_ok select 'vol: priame druhe clenstvo zamietnute', tt.expect_err('row-level security', format('insert into organization_memberships(volunteer_id,organization_id) select id,%L from volunteers', :'org2'));
reset role;
select tt.as_user('00000000-0000-0000-0000-0000000000b1');
insert into t_ok select 'vol: obnova prilis skoro', tt.expect_err('RENEW_TOO_EARLY','select renew_license()');

-- prestup
select request_transfer(:'org2') as tr \gset
insert into t_ok select 'prestup: druhy otvoreny zamietnuty', tt.expect_err('TRANSFER_OPEN', format('select request_transfer(%L)', :'org2'));
select tt.as_user('00000000-0000-0000-0000-0000000000c2');
insert into t_ok select 'prestup: cielova org este nemoze', tt.expect_err('FORBIDDEN', format('select decide_transfer(%L,%L)', :'tr','approve'));
select tt.as_user('00000000-0000-0000-0000-0000000000c1');
select decide_transfer(:'tr','approve');
select tt.as_user('00000000-0000-0000-0000-0000000000c2');
select decide_transfer(:'tr','approve');
insert into t_ok select 'prestup: domovska org zmenena, jedno aktivne',
  (select home_organization_id=:'org2' from volunteers where registration_number=:'rn')
  and (select count(*)=1 from organization_memberships where status='active')
  and (select registration_number=:'rn' from volunteers);

-- lehota 30 dní: nič sa neschváli automaticky
select tt.as_user('00000000-0000-0000-0000-0000000000b1');
select request_transfer(:'org') as tr2 \gset
reset role;
select tt.as_user(null);
select set_config('sdz.fn','1',false);
update volunteer_transfers set origin_due_at = now() - interval '1 day' where id=:'tr2';  -- test (superuser)
select run_daily_maintenance();
insert into t_ok select 'prestup: po 30 dnoch overdue_review, nie schvaleny',
  (select status='overdue_review' and overdue_from='origin' from volunteer_transfers where id=:'tr2')
  and (select home_organization_id=:'org2' from volunteers);

-- licencia: expirácia cez cron
alter table volunteer_licenses disable trigger licenses_guard;
update volunteer_licenses set expires_on = current_date - 1, issued_on = current_date - 100;
alter table volunteer_licenses enable trigger licenses_guard;
select run_daily_maintenance();
insert into t_ok select 'licencia: expirovana cronom', (select status='expired' from volunteer_licenses);
select tt.as_user('00000000-0000-0000-0000-0000000000b1');
select renew_license();
insert into t_ok select 'licencia: obnova vytvorila novu s novym cislom',
  (select count(*)=2 and count(distinct license_number)=2 from volunteer_licenses)
  and (select count(*)=1 from volunteer_licenses where status='active');

-- verejná karta
select tt.as_user(null);
insert into t_ok select 'karta: neplatny format = null', get_public_card('xyz') is null;
insert into t_ok select 'karta: bez emailu/telefonu', get_public_card(:'rn') is not null
  and not (get_public_card(:'rn') ?| array['email','phone']) and get_public_card(:'rn')->'organization' = 'null'::jsonb;

-- RLS: org A nevidí dobrovoľníkov org B
select tt.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
insert into t_ok select 'rls: org A nevidi dobrovolnika org B', (select count(*)=0 from volunteers);
select tt.as_user('00000000-0000-0000-0000-0000000000c2');
insert into t_ok select 'rls: org B vidi svojho dobrovolnika', (select count(*)=1 from volunteers);
reset role;

\set QUIET off
select name, case when ok then 'OK' else 'FAIL' end as vysledok from t_ok order by ctid;
select count(*) filter (where not ok) as zlyhania, count(*) as spolu from t_ok;
