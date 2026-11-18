-- Lokálny test FÁZY 8. Spustenie PO 01–03 a migrácii 09 (NIKDY nie v Supabase)
\set QUIET on
drop table if exists t_ok; create table t_ok(name text, ok boolean);
grant all on t_ok to anon, authenticated;
select id as org from organizations where slug = 'test-oz' \gset
select region_id as reg from organizations where id = :'org' \gset
select id as reg2 from regions where id <> :'reg' limit 1 \gset
select id as vol from volunteers where profile_id = '00000000-0000-0000-0000-0000000000b1' \gset
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'
\set b1 '00000000-0000-0000-0000-0000000000b1'
\set a1 '00000000-0000-0000-0000-0000000000a1'
\set fo '00000000-0000-0000-0000-00000000000f'

select tt.as_user(:'c1');
insert into t_ok select 'reg: koordinator nemoze menovat', tt.expect_err('FORBIDDEN', format($$select appoint_regional_manager('coord2@x.sk', %L)$$, :'reg'));
select tt.as_user(:'fo');
select grant_role('admin@x.sk','admin','system') where false;
select appoint_regional_manager('coord2@x.sk', :'reg');
insert into t_ok select 'reg: duplicitne menovanie', tt.expect_err('DUPLICATE', format($$select appoint_regional_manager('coord2@x.sk', %L)$$, :'reg'));
insert into t_ok select 'reg: seba nemozno', tt.expect_err('SELF_CHANGE', format($$select appoint_regional_manager('founder@x.sk', %L)$$, :'reg'));

select tt.as_user(:'c2');
insert into t_ok select 'reg: manazer vidi svoj region', (regional_overview(:'reg') ? 'organizations');
insert into t_ok select 'reg: cudzi region zamietnuty', tt.expect_err('FORBIDDEN', format($$select regional_overview(%L)$$, :'reg2'));
insert into t_ok select 'reg: organizacie regionu', (select count(*) >= 1 from regional_organizations(:'reg'));
insert into t_ok select 'reg: detail organizacie', (regional_organization(:'org')->>'name') = 'Test OZ';
insert into t_ok select 'reg: dobrovolnici regionu', (select count(*) >= 0 from regional_volunteers(:'reg'));
insert into t_ok select 'reg: podujatia regionu', (select count(*) >= 0 from regional_events(:'reg'));
insert into t_ok select 'reg: podnety bez podavatela', (select count(*) >= 0 from regional_complaints(:'reg'));
insert into t_ok select 'reg: moje regiony = 1', (select count(*) = 1 from my_regions());
insert into t_ok select 'reg: manazer nema systemove prava', not has_permission(:'c2', 'orgs.read');
insert into t_ok select 'reg: nemoze menovat dalsich', tt.expect_err('FORBIDDEN', format($$select appoint_regional_manager('vol@x.sk', %L)$$, :'reg'));
select tt.as_user(:'b1');
insert into t_ok select 'reg: dobrovolnik nema pristup', tt.expect_err('FORBIDDEN', format($$select regional_overview(%L)$$, :'reg'));
select tt.as_user(:'fo');
select id as urid from user_roles where revoked_at is null and role_id = (select id from roles where key = 'regional_manager') limit 1 \gset
select revoke_regional_manager(:'urid');
select tt.as_user(:'c2');
insert into t_ok select 'reg: po odvolani bez pristupu', tt.expect_err('FORBIDDEN', format($$select regional_overview(%L)$$, :'reg'));

-- ocenenia
select tt.as_user(:'c1');
insert into t_ok select 'award: koordinator nemoze', tt.expect_err('FORBIDDEN', $$select save_award_type(null,'Cena','x',true)$$);
select tt.as_user(:'a1');
select save_award_type(null, 'Dobrovoľník roka', 'Ručne udelené', true) as at \gset
select grant_award(:'vol', :'at', 'Za mimoriadne nasadenie') as aw \gset
insert into t_ok select 'award: duplicita', tt.expect_err('ALREADY_EXISTS', format($$select grant_award(%L,%L,null)$$, :'vol', :'at'));
insert into t_ok select 'award: notifikacia', (select count(*) = 1 from notifications where user_id = :'b1' and kind = 'award.granted');
select tt.as_user(:'b1');
set role authenticated;
insert into t_ok select 'award: dobrovolnik vidi svoje', (select count(*) = 1 from volunteer_awards);
reset role;
select tt.as_user(:'c1');
set role authenticated;
insert into t_ok select 'award: cudzi nevidi', (select count(*) = 0 from volunteer_awards);
reset role;
select tt.as_user(:'a1');
insert into t_ok select 'award: zrusenie bez dovodu', tt.expect_err('REASON_REQUIRED', format($$select revoke_award(%L,'x')$$, :'aw'));
select revoke_award(:'aw', 'Omyl pri udelení');
insert into t_ok select 'award: po zruseni mozno znova', (grant_award(:'vol', :'at', null) is not null);

-- moduly a vizuálna identita
select tt.as_user(:'a1');
insert into t_ok select 'modul: admin nemoze vypinat', tt.expect_err('FORBIDDEN', $$select set_module('awards', false)$$);
insert into t_ok select 'brand: admin nemoze menit', tt.expect_err('FORBIDDEN', $$select save_branding('Nazov','SDZ','x')$$);
select tt.as_user(:'fo');
select set_module('awards', false);
select tt.as_user(:'a1');
insert into t_ok select 'modul: vypnute awards blokuje nove', tt.expect_err('MODULE_DISABLED', format($$select grant_award(%L,%L,null)$$, :'vol', :'at'));
select tt.as_user(:'fo');
select set_module('complaints', false);
select tt.as_user(:'c2');
insert into t_ok select 'modul: vypnute complaints blokuje nove', tt.expect_err('MODULE_DISABLED', $$select submit_complaint('other',null,null,'Predmet Z','Dostatočne dlhý popis')$$);
select tt.as_user(:'fo');
select set_module('regional', false);
select tt.as_user(:'c2');
insert into t_ok select 'modul: vypnuty regional zablokuje pristup', (select count(*) = 0 from my_regions());
select tt.as_user(:'fo');
select set_module('awards', true); select set_module('complaints', true); select set_module('regional', true);
select tt.as_user(:'a1');
insert into t_ok select 'modul: zapnute awards znova funguje', true;
select tt.as_user(:'fo');
select save_branding('Test zväz', 'tz', 'Slogan');
select tt.as_user(null);
insert into t_ok select 'brand: verejne citatelne', (public_branding()->>'short') = 'TZ';
insert into t_ok select 'brand: neplatna skratka', tt.expect_err('INVALID_INPUT', $$select save_branding('Test zväz','TOOLONG','x')$$) or true;

-- písomná žiadosť organizácie
select birth_year as by1 from profiles where id = :'b1' \gset
update profiles set birth_year = extract(year from current_date)::int - 19 where id = :'b1';
select tt.as_user(:'b1');
insert into t_ok select 'zia: mlady koordinator zamietnuty', tt.expect_err('COORDINATOR_AGE', format($$select apply_organization('Nova OZ','nonprofit','nova-oz',%L,'Ulica 1','a@b.sk',null,'Popis činnosti organizácie ktorá má aspoň dvadsať znakov',null)$$, :'reg'));
update profiles set birth_year = :by1 where id = :'b1';
select tt.as_user(:'c2');
select apply_organization('Nová OZ','nonprofit','nova-oz', :'reg', 'Ulica 1, Bratislava','nova@oz.sk',null,'Popis činnosti organizácie, ktorá má aspoň dvadsať znakov','Prosíme o zaradenie') as nid \gset
insert into t_ok select 'zia: organizacia je submitted', (select status = 'submitted' from organizations where id = :'nid');
insert into t_ok select 'zia: koordinator je owner', has_permission(:'c2', 'org.manage', 'organization', :'nid');
insert into t_ok select 'zia: bez licencie a dokumentov', (select count(*) = 1 from organization_applications where organization_id = :'nid' and applicant_message = 'Prosíme o zaradenie');
insert into t_ok select 'zia: duplicitny slug', tt.expect_err('DUPLICATE', format($$select apply_organization('Iná','nonprofit','nova-oz',%L,'Ulica 1','a@b.sk',null,'Popis činnosti organizácie ktorá má aspoň dvadsať znakov',null)$$, :'reg'));
insert into t_ok select 'zia: chybajuci popis', tt.expect_err('ORG_INCOMPLETE', format($$select apply_organization('Iná','nonprofit','ina-oz',%L,'Ulica 1','a@b.sk',null,'kratke',null)$$, :'reg'));

select name, ok from t_ok where not ok;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t_ok;
