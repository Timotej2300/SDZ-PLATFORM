-- SDZ FÁZA 6: oznámenia, e-mailová fronta, systémové oznamy, štatistiky, exporty

insert into public.permissions (key, scope, description) values
  ('analytics.read', 'system', 'Centrálne štatistiky'),
  ('announcements.manage', 'system', 'Systémové oznamy'),
  ('exports.run', 'system', 'Centrálne exporty údajov'),
  ('analytics.view', 'organization', 'Štatistiky organizácie'),
  ('exports.org', 'organization', 'Exporty údajov organizácie');

with m(role_key, perms) as (values
  ('president', array['analytics.read','announcements.manage','exports.run']),
  ('secretary_general', array['analytics.read','announcements.manage','exports.run']),
  ('admin', array['analytics.read','announcements.manage','exports.run']),
  ('vice_president', array['analytics.read']),
  ('auditor', array['analytics.read','exports.run']),
  ('org_owner', array['analytics.view','exports.org']),
  ('org_chairman', array['analytics.view','exports.org']),
  ('org_administrator', array['analytics.view','exports.org']),
  ('org_vice_chairman', array['analytics.view']),
  ('org_volunteer_manager', array['analytics.view']),
  ('org_event_manager', array['analytics.view'])
)
insert into public.role_permissions (role_id, permission_key)
select r.id, p from m join public.roles r on r.key = m.role_key, unnest(m.perms) p;

-- ============ OZNÁMENIA ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null check (char_length(kind) <= 60),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 2000),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_\-\.?=&]*$'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
create policy notifications_own on public.notifications for select using (user_id = auth.uid());

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id),
  email_enabled boolean not null default true,
  muted_kinds text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy notif_prefs_own on public.notification_preferences for select using (user_id = auth.uid());

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';
alter table public.email_outbox enable row level security; -- bez politík: len service role

-- vnútorná funkcia: vytvorí oznámenie a (podľa nastavení) e-mail vo fronte
create function public.notify(p_user uuid, p_kind text, p_title text, p_body text default null,
                              p_link text default null, p_email boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text; v_pref public.notification_preferences%rowtype; v_has_pref boolean;
begin
  if p_user is null then return; end if;
  select email into v_email from public.profiles where id = p_user;
  if v_email is null then return; end if;
  select * into v_pref from public.notification_preferences where user_id = p_user;
  v_has_pref := found;
  if v_has_pref and (p_kind = any (v_pref.muted_kinds) or split_part(p_kind, '.', 1) = any (v_pref.muted_kinds)) then return; end if;
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
  if p_email and (not v_has_pref or v_pref.email_enabled) then
    insert into public.email_outbox (user_id, to_email, subject, body) values (p_user, v_email, p_title, coalesce(p_body, p_title));
  end if;
end $$;
revoke execute on function public.notify(uuid, text, text, text, text, boolean) from public, anon, authenticated;

-- zamestnanci organizácie s oprávnením
create function public.notify_org_staff(p_org uuid, p_perm text, p_kind text, p_title text,
                                        p_body text default null, p_link text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select distinct ur.user_id from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
     where ur.revoked_at is null and rp.permission_key = p_perm
       and ur.scope_type = 'organization' and ur.scope_id = p_org
  loop
    perform public.notify(r.user_id, p_kind, p_title, p_body, p_link);
  end loop;
end $$;
revoke execute on function public.notify_org_staff(uuid, text, text, text, text, text) from public, anon, authenticated;

create function public.mark_notification_read(p_id uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_id is null or id = p_id);
end $$;

create function public.save_notification_prefs(p_email boolean, p_muted text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  insert into public.notification_preferences (user_id, email_enabled, muted_kinds)
  values (auth.uid(), p_email, coalesce(p_muted, '{}'))
  on conflict (user_id) do update set email_enabled = excluded.email_enabled,
    muted_kinds = excluded.muted_kinds, updated_at = now();
end $$;

-- ============ SPÚŠŤAČE OZNÁMENÍ ============
create function public.trg_notify_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid; v_title text; v_org uuid;
begin
  select profile_id into v_profile from public.volunteers where id = new.volunteer_id;
  select title, organization_id into v_title, v_org from public.events where id = new.event_id;
  if tg_op = 'INSERT' then
    if new.status = 'submitted' then
      perform public.notify_org_staff(v_org, 'applications.decide', 'application.new',
        'Nová prihláška na podujatie', v_title, '/organization/applications');
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'submitted' and old.status in ('draft', 'needs_info') then
      perform public.notify_org_staff(v_org, 'applications.decide', 'application.new',
        'Prihláška bola odoslaná', v_title, '/organization/applications');
    elsif new.status in ('approved', 'assigned', 'rejected', 'needs_info') then
      perform public.notify(v_profile, 'application.' || new.status,
        case new.status when 'approved' then 'Vaša prihláška bola schválená'
                        when 'assigned' then 'Boli ste zaradený na zmenu'
                        when 'rejected' then 'Vaša prihláška bola zamietnutá'
                        else 'K prihláške sú potrebné doplňujúce informácie' end,
        v_title, '/account/applications');
    end if;
  end if;
  return new;
end $$;
create trigger applications_notify after insert or update of status on public.applications
  for each row execute function public.trg_notify_application();

create function public.trg_notify_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for r in select distinct v.profile_id from public.applications a
               join public.volunteers v on v.id = a.volunteer_id
              where a.event_id = new.id and a.status in ('submitted', 'in_review', 'needs_info', 'approved', 'assigned')
    loop
      perform public.notify(r.profile_id, 'event.cancelled', 'Podujatie bolo zrušené', new.title, '/account/applications');
    end loop;
  end if;
  return new;
end $$;
create trigger events_notify after update of status on public.events
  for each row execute function public.trg_notify_event();

create function public.trg_notify_license() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if new.status is distinct from old.status and new.status in ('expiring', 'expired', 'cancelled') then
    select profile_id into v_profile from public.volunteers where id = new.volunteer_id;
    perform public.notify(v_profile, 'license.' || new.status,
      case new.status when 'expiring' then 'Vaša SDZ licencia čoskoro vyprší'
                      when 'expired' then 'Vaša SDZ licencia vypršala'
                      else 'Vaša SDZ licencia bola zrušená' end,
      'Platnosť do ' || to_char(new.expires_on, 'DD.MM.YYYY'), '/account/license');
  end if;
  return new;
end $$;
create trigger licenses_notify after update of status on public.volunteer_licenses
  for each row execute function public.trg_notify_license();

create function public.trg_notify_transfer() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if new.status is distinct from old.status then
    select profile_id into v_profile from public.volunteers where id = new.volunteer_id;
    perform public.notify(v_profile, 'transfer.' || new.status, 'Zmena stavu prestupu', new.from_org_name || ' → ' || new.to_org_name, '/account/transfers');
  end if;
  return new;
end $$;
create trigger transfers_notify after update of status on public.volunteer_transfers
  for each row execute function public.trg_notify_transfer();

create function public.trg_notify_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'needs_info', 'suspended') then
    perform public.notify(new.created_by, 'organization.' || new.status,
      case new.status when 'approved' then 'Organizácia bola schválená'
                      when 'rejected' then 'Žiadosť organizácie bola zamietnutá'
                      when 'needs_info' then 'K žiadosti organizácie sú potrebné informácie'
                      else 'Organizácia bola pozastavená' end,
      new.name, '/organization');
    if new.status = 'suspended' then
      perform public.notify_org_staff(new.id, 'org.manage', 'organization.suspended', 'Organizácia bola pozastavená', new.name, '/organization');
    end if;
  end if;
  return new;
end $$;
create trigger organizations_notify after update of status on public.organizations
  for each row execute function public.trg_notify_org();

create function public.trg_notify_certificate() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  select profile_id into v_profile from public.volunteers where id = new.volunteer_id;
  perform public.notify(v_profile, 'certificate.issued', 'Bol vám vystavený certifikát', new.title, '/account/certificates');
  return new;
end $$;
create trigger certificates_notify after insert on public.volunteer_certificates
  for each row execute function public.trg_notify_certificate();

-- ============ SYSTÉMOVÉ OZNAMY ============
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  body text not null check (char_length(body) between 3 and 4000),
  audience text not null check (audience in ('all', 'volunteers', 'org_staff')),
  send_email boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.announcements enable row level security;
create policy announcements_read on public.announcements for select to authenticated
  using ((expires_at is null or expires_at > now())
         and (audience = 'all'
              or (audience = 'volunteers' and exists (select 1 from public.volunteers v where v.profile_id = auth.uid()))
              or (audience = 'org_staff' and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.revoked_at is null and ur.scope_type = 'organization')))
         or public.has_permission(auth.uid(), 'announcements.manage'));
create trigger audit_announcements after insert or update or delete on public.announcements
  for each row execute function public.audit_row();

create function public.publish_announcement(p_title text, p_body text, p_audience text,
                                            p_email boolean default false, p_expires timestamptz default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; r record;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'announcements.manage') then raise exception 'FORBIDDEN'; end if;
  if p_audience not in ('all', 'volunteers', 'org_staff') then raise exception 'INVALID_INPUT'; end if;
  insert into public.announcements (title, body, audience, send_email, created_by, expires_at)
  values (trim(p_title), trim(p_body), p_audience, p_email, auth.uid(), p_expires) returning id into v_id;
  for r in
    select p.id from public.profiles p
     where p_audience = 'all'
        or (p_audience = 'volunteers' and exists (select 1 from public.volunteers v where v.profile_id = p.id and v.status = 'active'))
        or (p_audience = 'org_staff' and exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.revoked_at is null and ur.scope_type = 'organization'))
  loop
    perform public.notify(r.id, 'announcement', trim(p_title), left(trim(p_body), 1900), '/account/notifications', p_email);
  end loop;
  return v_id;
end $$;

-- ============ ŠTATISTIKY ============
create function public.admin_analytics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j jsonb;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'analytics.read') then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'volunteers', jsonb_build_object(
      'total', (select count(*) from public.volunteers),
      'active', (select count(*) from public.volunteers where status = 'active'),
      'with_valid_license', (select count(distinct volunteer_id) from public.volunteer_licenses where status in ('active', 'expiring') and expires_on >= current_date)),
    'licenses_expiring_90d', (select count(*) from public.volunteer_licenses where status in ('active', 'expiring') and expires_on between current_date and current_date + 90),
    'organizations', coalesce((select jsonb_object_agg(status, c) from (select status::text, count(*) c from public.organizations group by 1) s), '{}'),
    'events', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from public.events group by 1) s), '{}'),
    'applications', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from public.applications group by 1) s), '{}'),
    'hours_total', coalesce((select sum(hours) from public.volunteer_hours), 0),
    'certificates', (select count(*) from public.volunteer_certificates where revoked_at is null),
    'hours_by_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'hours', h) order by m)
        from (select to_char(date_trunc('month', checked_in_at at time zone 'Europe/Bratislava'), 'YYYY-MM') m, sum(hours) h
                from public.volunteer_hours where checked_in_at > now() - interval '12 months' group by 1) q), '[]'),
    'orgs_by_region', coalesce((select jsonb_agg(jsonb_build_object('region', name, 'count', c) order by name)
        from (select coalesce(r.name, 'Bez regiónu') name, count(*) c from public.organizations o
                left join public.regions r on r.id = o.region_id where o.status = 'approved' group by 1) q), '[]'),
    'top_organizations', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'hours', h) order by h desc)
        from (select o.name, sum(vh.hours) h from public.volunteer_hours vh
                join public.events e on e.id = vh.event_id join public.organizations o on o.id = e.organization_id
               group by o.name order by 2 desc limit 10) q), '[]')
  ) into j;
  return j;
end $$;

create function public.org_stats(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j jsonb;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'analytics.view', 'organization', p_org) then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'members', (select count(*) from public.organization_memberships where organization_id = p_org and status = 'active'),
    'events', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from public.events where organization_id = p_org group by 1) s), '{}'),
    'applications', coalesce((select jsonb_object_agg(status, c) from (select a.status, count(*) c from public.applications a
        join public.events e on e.id = a.event_id where e.organization_id = p_org group by 1) s), '{}'),
    'hours_total', coalesce((select sum(vh.hours) from public.volunteer_hours vh join public.events e on e.id = vh.event_id where e.organization_id = p_org), 0),
    'volunteers_worked', (select count(distinct vh.volunteer_id) from public.volunteer_hours vh join public.events e on e.id = vh.event_id where e.organization_id = p_org),
    'certificates', (select count(*) from public.volunteer_certificates c join public.events e on e.id = c.event_id where e.organization_id = p_org and c.revoked_at is null),
    'events_fill', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'capacity', capacity, 'assigned', n, 'starts_at', starts_at) order by starts_at desc)
        from (select e.title, e.capacity, e.starts_at,
                     (select count(*) from public.applications a where a.event_id = e.id and a.status in ('approved', 'assigned')) n
                from public.events e where e.organization_id = p_org and e.status = 'published'
               order by e.starts_at desc limit 10) q), '[]')
  ) into j;
  return j;
end $$;

-- ============ EXPORTY (s auditom) ============
create function public.export_rows(p_kind text, p_org uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_kind in ('org_volunteers', 'org_attendance') then
    if p_org is null or not public.has_permission(auth.uid(), 'exports.org', 'organization', p_org) then raise exception 'FORBIDDEN'; end if;
    if p_kind = 'org_volunteers' then
      select coalesce(jsonb_agg(jsonb_build_object(
          'registracne_cislo', v.registration_number, 'meno', p.first_name, 'priezvisko', p.last_name,
          'clenom_od', to_char(m.started_at at time zone 'Europe/Bratislava', 'YYYY-MM-DD'),
          'licencia', coalesce((select l.status::text from public.volunteer_licenses l where l.volunteer_id = v.id order by l.created_at desc limit 1), 'ziadna'))
          order by p.last_name, p.first_name), '[]') into j
        from public.organization_memberships m
        join public.volunteers v on v.id = m.volunteer_id join public.profiles p on p.id = v.profile_id
       where m.organization_id = p_org and m.status = 'active';
    else
      select coalesce(jsonb_agg(jsonb_build_object(
          'podujatie', e.title, 'registracne_cislo', v.registration_number, 'meno', p.first_name, 'priezvisko', p.last_name,
          'prichod', a.checked_in_at, 'odchod', a.checked_out_at,
          'hodiny', case when a.checked_out_at is null then null else round(extract(epoch from (a.checked_out_at - a.checked_in_at)) / 3600.0, 2) end)
          order by a.checked_in_at desc), '[]') into j
        from public.attendance_records a join public.events e on e.id = a.event_id
        join public.volunteers v on v.id = a.volunteer_id join public.profiles p on p.id = v.profile_id
       where e.organization_id = p_org;
    end if;
  elsif p_kind in ('central_organizations', 'central_events') then
    if not public.has_permission(auth.uid(), 'exports.run') then raise exception 'FORBIDDEN'; end if;
    if p_kind = 'central_organizations' then
      select coalesce(jsonb_agg(jsonb_build_object('cislo', o.org_number, 'nazov', o.name, 'typ', o.type, 'stav', o.status,
          'region', r.name, 'clenov', (select count(*) from public.organization_memberships m where m.organization_id = o.id and m.status = 'active'))
          order by o.name), '[]') into j
        from public.organizations o left join public.regions r on r.id = o.region_id;
    else
      select coalesce(jsonb_agg(jsonb_build_object('nazov', e.title, 'organizacia', o.name, 'stav', e.status,
          'zaciatok', e.starts_at, 'koniec', e.ends_at, 'kapacita', e.capacity,
          'zaradenych', (select count(*) from public.applications a where a.event_id = e.id and a.status in ('approved', 'assigned')))
          order by e.starts_at desc), '[]') into j
        from public.events e join public.organizations o on o.id = e.organization_id;
    end if;
  else
    raise exception 'INVALID_INPUT';
  end if;
  perform public.audit_write('export.run', 'export', p_kind, null,
    jsonb_build_object('org', p_org, 'rows', jsonb_array_length(j)));
  return j;
end $$;

-- ============ ÚDRŽBA: fronta e-mailov ============
create function public.claim_outbox(p_limit int default 50) returns setof public.email_outbox
language plpgsql security definer set search_path = public as $$
begin
  return query
  with c as (
    select id from public.email_outbox where status = 'pending' and attempts < 5
     order by created_at limit p_limit for update skip locked)
  update public.email_outbox o set attempts = o.attempts + 1 from c where o.id = c.id returning o.*;
end $$;
revoke execute on function public.claim_outbox(int) from public, anon, authenticated;

create function public.finish_outbox(p_id uuid, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.email_outbox
     set status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
         sent_at = case when p_ok then now() end, last_error = left(p_error, 500)
   where id = p_id;
end $$;
revoke execute on function public.finish_outbox(uuid, boolean, text) from public, anon, authenticated;

-- retencia: prečítané oznámenia po 12 mesiacoch, odoslané e-maily po 90 dňoch
create function public.purge_old_notifications() returns int
language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  delete from public.notifications where read_at is not null and created_at < now() - interval '12 months';
  get diagnostics a = row_count;
  delete from public.email_outbox where status in ('sent', 'failed') and created_at < now() - interval '90 days';
  get diagnostics b = row_count;
  return a + b;
end $$;
revoke execute on function public.purge_old_notifications() from public, anon, authenticated;

-- pripomienka podujatia (24 h vopred) pre zaradených dobrovoľníkov; raz na podujatie a osobu
create table public.event_reminders (
  event_id uuid not null references public.events(id),
  volunteer_id uuid not null references public.volunteers(id),
  sent_at timestamptz not null default now(),
  primary key (event_id, volunteer_id)
);
alter table public.event_reminders enable row level security;

create function public.send_event_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select e.id eid, e.title, a.volunteer_id, v.profile_id
      from public.events e join public.applications a on a.event_id = e.id and a.status in ('approved', 'assigned')
      join public.volunteers v on v.id = a.volunteer_id
     where e.status = 'published' and e.starts_at > now() and e.starts_at <= now() + interval '24 hours'
       and not exists (select 1 from public.event_reminders x where x.event_id = e.id and x.volunteer_id = a.volunteer_id)
  loop
    insert into public.event_reminders (event_id, volunteer_id) values (r.eid, r.volunteer_id);
    perform public.notify(r.profile_id, 'event.reminder', 'Podujatie sa začína do 24 hodín', r.title, '/account/calendar');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.send_event_reminders() from public, anon, authenticated;

-- rozšírenie dennej údržby
create or replace function public.run_daily_maintenance() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_exp int; n_expd int; n_od int; n_end int; n_rem int; n_purge int;
begin
  perform set_config('sdz.fn', '1', true);

  with u as (
    update public.volunteer_licenses set status = 'expiring'
     where status = 'active' and expires_on <= current_date + 90 and expires_on >= current_date
    returning id)
  insert into public.license_history (license_id, event, old_status, new_status, note)
  select id, 'auto_expiring', 'active', 'expiring', 'cron' from u;
  get diagnostics n_exp = row_count;

  with u as (
    update public.volunteer_licenses set status = 'expired'
     where status in ('active', 'expiring') and expires_on < current_date
    returning id, status)
  insert into public.license_history (license_id, event, new_status, note)
  select id, 'auto_expired', 'expired', 'cron' from u;
  get diagnostics n_expd = row_count;

  with u as (
    update public.volunteer_transfers
       set status = 'overdue_review', overdue_at = now(),
           overdue_from = case status when 'pending_origin' then 'origin' else 'target' end
     where (status = 'pending_origin' and origin_due_at < now())
        or (status = 'pending_target' and target_due_at < now())
    returning id, overdue_from)
  insert into public.transfer_history (transfer_id, event, payload)
  select id, 'overdue', jsonb_build_object('stage', overdue_from) from u;
  get diagnostics n_od = row_count;

  update public.volunteer_guestings set status = 'ended' where status = 'active' and ends_on < current_date;
  get diagnostics n_end = row_count;

  n_rem := public.send_event_reminders();
  n_purge := public.purge_old_notifications();

  return jsonb_build_object('licenses_expiring', n_exp, 'licenses_expired', n_expd,
                            'transfers_overdue', n_od, 'guestings_ended', n_end,
                            'reminders', n_rem, 'purged', n_purge);
end $$;
revoke execute on function public.run_daily_maintenance() from public, anon, authenticated;
