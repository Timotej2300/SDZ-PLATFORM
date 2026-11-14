-- SDZ FÁZA 1: počiatočné roly, oprávnenia, regióny a okresy, nastavenia (žiadne falošné záznamy)

insert into public.permissions (key, scope, description) values
  -- systémové
  ('roles.read', 'system', 'Čítanie rolí a priradení'),
  ('roles.write', 'system', 'Správa rolí a oprávnení'),
  ('users.read', 'system', 'Čítanie používateľov'),
  ('users.manage', 'system', 'Správa používateľov'),
  ('settings.write', 'system', 'Globálne nastavenia'),
  ('regions.manage', 'system', 'Správa regiónov a okresov'),
  ('audit.read', 'system', 'Čítanie auditných záznamov'),
  ('orgs.read', 'system', 'Čítanie všetkých organizácií'),
  ('orgs.review', 'system', 'Schvaľovanie organizácií'),
  ('volunteers.read.all', 'system', 'Čítanie centrálneho registra dobrovoľníkov'),
  ('volunteers.review', 'system', 'Schvaľovanie registrácií dobrovoľníkov'),
  ('licenses.manage', 'system', 'Pozastavenie a zrušenie licencií'),
  ('transfers.review', 'system', 'Preverenie nečinnosti pri prestupoch'),
  -- organizačné
  ('org.view', 'organization', 'Zobrazenie organizácie'),
  ('org.manage', 'organization', 'Úprava profilu organizácie'),
  ('org.staff.manage', 'organization', 'Správa pracovníkov a rolí organizácie'),
  ('org.documents', 'organization', 'Dokumenty organizácie'),
  ('volunteers.read', 'organization', 'Čítanie dobrovoľníkov organizácie'),
  ('volunteers.invite', 'organization', 'Pozvánky a žiadosti o registráciu dobrovoľníkov'),
  ('transfers.decide', 'organization', 'Rozhodovanie o prestupoch'),
  ('guesting.decide', 'organization', 'Rozhodovanie o hosťovaniach');

insert into public.roles (key, name, scope, is_system, is_protected) values
  ('founder', 'Founder', 'system', true, true),
  ('president', 'President', 'system', true, false),
  ('vice_president', 'Vice President', 'system', true, false),
  ('secretary_general', 'Secretary General', 'system', true, false),
  ('super_admin', 'Super Admin', 'system', true, false),
  ('admin', 'Admin', 'system', true, false),
  ('verification_manager', 'Verification Manager', 'system', true, false),
  ('moderator', 'Moderator', 'system', true, false),
  ('support', 'Support', 'system', true, false),
  ('auditor', 'Auditor', 'system', true, false),
  ('regional_manager', 'Regional Manager', 'region', true, false),
  ('org_owner', 'Organization Owner', 'organization', true, false),
  ('org_chairman', 'Chairman', 'organization', true, false),
  ('org_vice_chairman', 'Vice Chairman', 'organization', true, false),
  ('org_administrator', 'Administrator', 'organization', true, false),
  ('org_volunteer_manager', 'Volunteer Manager', 'organization', true, false),
  ('org_event_manager', 'Event Manager', 'organization', true, false),
  ('org_event_coordinator', 'Event Coordinator', 'organization', true, false),
  ('org_team_leader', 'Team Leader', 'organization', true, false),
  ('org_viewer', 'Viewer', 'organization', true, false);

with m(role_key, perms) as (values
  ('president', array['users.read','audit.read','orgs.read','orgs.review','volunteers.read.all','volunteers.review','licenses.manage','transfers.review']),
  ('secretary_general', array['users.read','audit.read','orgs.read','orgs.review','volunteers.read.all','volunteers.review','licenses.manage','transfers.review','regions.manage']),
  ('admin', array['users.read','audit.read','orgs.read','orgs.review','volunteers.read.all','volunteers.review','licenses.manage','transfers.review']),
  ('vice_president', array['users.read','audit.read','orgs.read','volunteers.read.all']),
  ('super_admin', array['users.read','audit.read']),
  ('verification_manager', array['orgs.read','orgs.review','volunteers.read.all','volunteers.review']),
  ('support', array['users.read']),
  ('auditor', array['users.read','audit.read','orgs.read','volunteers.read.all']),
  ('regional_manager', array['orgs.read','volunteers.read.all']),
  ('org_owner', array['org.view','org.manage','org.staff.manage','org.documents','volunteers.read','volunteers.invite','transfers.decide','guesting.decide']),
  ('org_chairman', array['org.view','org.manage','org.staff.manage','org.documents','volunteers.read','volunteers.invite','transfers.decide','guesting.decide']),
  ('org_administrator', array['org.view','org.manage','org.staff.manage','org.documents','volunteers.read','volunteers.invite','transfers.decide','guesting.decide']),
  ('org_vice_chairman', array['org.view','org.documents','volunteers.read','volunteers.invite','transfers.decide','guesting.decide']),
  ('org_volunteer_manager', array['org.view','volunteers.read','volunteers.invite','transfers.decide','guesting.decide']),
  ('org_event_manager', array['org.view','volunteers.read']),
  ('org_event_coordinator', array['org.view','volunteers.read']),
  ('org_team_leader', array['org.view']),
  ('org_viewer', array['org.view','volunteers.read'])
)
insert into public.role_permissions (role_id, permission_key)
select r.id, p from m join public.roles r on r.key = m.role_key, unnest(m.perms) p;

insert into public.regions (code, name) values
  ('BA', 'Bratislavský kraj'), ('TT', 'Trnavský kraj'), ('TN', 'Trenčiansky kraj'),
  ('NR', 'Nitriansky kraj'), ('ZA', 'Žilinský kraj'), ('BB', 'Banskobystrický kraj'),
  ('PO', 'Prešovský kraj'), ('KE', 'Košický kraj');

with d(code, names) as (values
  ('BA', array['Bratislava I','Bratislava II','Bratislava III','Bratislava IV','Bratislava V','Malacky','Pezinok','Senec']),
  ('TT', array['Dunajská Streda','Galanta','Hlohovec','Piešťany','Senica','Skalica','Trnava']),
  ('TN', array['Bánovce nad Bebravou','Ilava','Myjava','Nové Mesto nad Váhom','Partizánske','Považská Bystrica','Prievidza','Púchov','Trenčín']),
  ('NR', array['Komárno','Levice','Nitra','Nové Zámky','Šaľa','Topoľčany','Zlaté Moravce']),
  ('ZA', array['Bytča','Čadca','Dolný Kubín','Kysucké Nové Mesto','Liptovský Mikuláš','Martin','Námestovo','Ružomberok','Turčianske Teplice','Tvrdošín','Žilina']),
  ('BB', array['Banská Bystrica','Banská Štiavnica','Brezno','Detva','Krupina','Lučenec','Poltár','Revúca','Rimavská Sobota','Veľký Krtíš','Zvolen','Žarnovica','Žiar nad Hronom']),
  ('PO', array['Bardejov','Humenné','Kežmarok','Levoča','Medzilaborce','Poprad','Prešov','Sabinov','Snina','Stará Ľubovňa','Stropkov','Svidník','Vranov nad Topľou']),
  ('KE', array['Gelnica','Košice I','Košice II','Košice III','Košice IV','Košice-okolie','Michalovce','Rožňava','Sobrance','Spišská Nová Ves','Trebišov'])
)
insert into public.districts (region_id, name)
select r.id, n from d join public.regions r on r.code = d.code, unnest(d.names) n;

insert into public.system_settings (key, value, description, is_public) values
  ('transfer_sdz_override_mode', '"disabled"'::jsonb, 'Právomoc SDZ nahradiť súhlas organizácie pri prestupe: zatiaľ nedefinovaná (disabled)', false);
