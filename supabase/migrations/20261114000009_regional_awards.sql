-- SDZ FÁZA 8: regionálna administrácia a architektúra SDZ Awards (bez automatických pravidiel)

insert into public.permissions (key, scope, description) values
  ('awards.manage', 'system', 'Správa a ručné udeľovanie ocenení SDZ');
with m(role_key, perms) as (values
  ('president', array['awards.manage']),
  ('secretary_general', array['awards.manage']),
  ('admin', array['awards.manage'])
)
insert into public.role_permissions (role_id, permission_key)
select r.id, p from m join public.roles r on r.key = m.role_key, unnest(m.perms) p;

-- ============ REGIONÁLNY PRÍSTUP ============
-- true: centrálna rola s orgs.read alebo regionálny manažér daného regiónu
create function public.region_access(p_region uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and p_region is not null and (
    public.has_permission(auth.uid(), 'orgs.read')
    or exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
       where ur.user_id = auth.uid() and ur.revoked_at is null and r.key = 'regional_manager'
         and ur.scope_type = 'region' and ur.scope_id = p_region))
$$;

create function public.my_regions() returns table (id uuid, code text, name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.code, r.name from public.regions r
   where auth.uid() is not null and (
     public.has_permission(auth.uid(), 'orgs.read')
     or exists (select 1 from public.user_roles ur join public.roles ro on ro.id = ur.role_id
                 where ur.user_id = auth.uid() and ur.revoked_at is null and ro.key = 'regional_manager'
                   and ur.scope_type = 'region' and ur.scope_id = r.id))
   order by r.name
$$;

create function public.appoint_regional_manager(p_email text, p_region uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_id uuid; v_role uuid;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'regions.manage') then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.regions where id = p_region) then raise exception 'NOT_FOUND'; end if;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_user = auth.uid() then raise exception 'SELF_CHANGE'; end if;
  select id into v_role from public.roles where key = 'regional_manager';
  begin
    insert into public.user_roles (user_id, role_id, scope_type, scope_id, granted_by)
    values (v_user, v_role, 'region', p_region, auth.uid()) returning id into v_id;
  exception when unique_violation then raise exception 'DUPLICATE'; end;
  perform public.audit_write('regional_manager.appointed', 'user_roles', v_id::text, null,
    jsonb_build_object('user', v_user, 'region', p_region));
  perform public.notify(v_user, 'region.appointed', 'Boli ste vymenovaný za regionálneho manažéra',
    (select name from public.regions where id = p_region), '/regional');
  return v_id;
end $$;

create function public.revoke_regional_manager(p_user_role_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ur public.user_roles%rowtype;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'regions.manage') then raise exception 'FORBIDDEN'; end if;
  select u.* into ur from public.user_roles u join public.roles r on r.id = u.role_id
   where u.id = p_user_role_id and r.key = 'regional_manager' and u.revoked_at is null for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.user_roles set revoked_at = now() where id = p_user_role_id;
  perform public.audit_write('regional_manager.revoked', 'user_roles', p_user_role_id::text, null,
    jsonb_build_object('user', ur.user_id, 'region', ur.scope_id));
end $$;

create function public.regional_managers() returns table (id uuid, region_id uuid, name text, email text, granted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'orgs.read') then raise exception 'FORBIDDEN'; end if;
  return query
  select ur.id, ur.scope_id, p.first_name || ' ' || p.last_name, p.email, ur.granted_at
    from public.user_roles ur join public.roles r on r.id = ur.role_id join public.profiles p on p.id = ur.user_id
   where r.key = 'regional_manager' and ur.revoked_at is null order by p.last_name;
end $$;

create function public.regional_overview(p_region uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.region_access(p_region) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'organizations', coalesce((select jsonb_object_agg(status, c) from (select status::text, count(*) c from public.organizations where region_id = p_region group by 1) s), '{}'),
    'volunteers', (select count(distinct v.id) from public.volunteers v join public.organizations o on o.id = v.home_organization_id where o.region_id = p_region),
    'valid_licenses', (select count(distinct l.volunteer_id) from public.volunteer_licenses l join public.volunteers v on v.id = l.volunteer_id
        join public.organizations o on o.id = v.home_organization_id
        where o.region_id = p_region and l.status in ('active', 'expiring') and l.expires_on >= current_date),
    'events', coalesce((select jsonb_object_agg(status, c) from (select e.status, count(*) c from public.events e
        join public.organizations o on o.id = e.organization_id where coalesce(e.region_id, o.region_id) = p_region group by 1) s), '{}'),
    'hours_total', coalesce((select sum(vh.hours) from public.volunteer_hours vh join public.events e on e.id = vh.event_id
        join public.organizations o on o.id = e.organization_id where coalesce(e.region_id, o.region_id) = p_region), 0),
    'open_complaints', (select count(*) from public.complaints c join public.organizations o on o.id = c.target_org_id
        where o.region_id = p_region and c.status in ('new', 'in_review', 'needs_info')),
    'hours_by_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'hours', h) order by m)
        from (select to_char(date_trunc('month', vh.checked_in_at at time zone 'Europe/Bratislava'), 'YYYY-MM') m, sum(vh.hours) h
                from public.volunteer_hours vh join public.events e on e.id = vh.event_id join public.organizations o on o.id = e.organization_id
               where coalesce(e.region_id, o.region_id) = p_region and vh.checked_in_at > now() - interval '12 months' group by 1) q), '[]')
  );
end $$;

create function public.regional_organizations(p_region uuid) returns table (
  id uuid, org_number text, name text, status text, type text, district text, members bigint, events bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.region_access(p_region) then raise exception 'FORBIDDEN'; end if;
  return query
  select o.id, o.org_number, o.name, o.status::text, o.type, d.name,
         (select count(*) from public.organization_memberships m where m.organization_id = o.id and m.status = 'active'),
         (select count(*) from public.events e where e.organization_id = o.id)
    from public.organizations o left join public.districts d on d.id = o.district_id
   where o.region_id = p_region and o.status in ('approved', 'suspended') order by o.name;
end $$;

create function public.regional_organization(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.organizations%rowtype;
begin
  select * into o from public.organizations where id = p_org;
  if not found or not public.region_access(o.region_id) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object('id', o.id, 'org_number', o.org_number, 'name', o.name, 'status', o.status, 'type', o.type,
    'description', o.description, 'address', o.address, 'website', o.website, 'contact_email', o.contact_email, 'contact_phone', o.contact_phone,
    'members', (select count(*) from public.organization_memberships m where m.organization_id = o.id and m.status = 'active'),
    'events', (select count(*) from public.events e where e.organization_id = o.id),
    'hours', coalesce((select sum(vh.hours) from public.volunteer_hours vh join public.events e on e.id = vh.event_id where e.organization_id = o.id), 0),
    'suspension', (select jsonb_build_object('reason', s.reason, 'starts_at', s.starts_at, 'ends_at', s.ends_at) from public.organization_suspensions s
                    where s.organization_id = o.id and s.status = 'active'));
end $$;

create function public.regional_volunteers(p_region uuid) returns table (
  registration_number text, full_name text, organization text, license_status text, license_expires date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.region_access(p_region) then raise exception 'FORBIDDEN'; end if;
  return query
  select v.registration_number, p.first_name || ' ' || p.last_name, o.name,
         l.status::text, l.expires_on
    from public.volunteers v join public.profiles p on p.id = v.profile_id
    join public.organizations o on o.id = v.home_organization_id
    left join lateral (select x.status, x.expires_on from public.volunteer_licenses x where x.volunteer_id = v.id order by x.created_at desc limit 1) l on true
   where o.region_id = p_region order by p.last_name, p.first_name limit 2000;
end $$;

create function public.regional_events(p_region uuid) returns table (
  id uuid, title text, organization text, status text, starts_at timestamptz, ends_at timestamptz, capacity int, assigned bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.region_access(p_region) then raise exception 'FORBIDDEN'; end if;
  return query
  select e.id, e.title, o.name, e.status, e.starts_at, e.ends_at, e.capacity,
         (select count(*) from public.applications a where a.event_id = e.id and a.status in ('approved', 'assigned'))
    from public.events e join public.organizations o on o.id = e.organization_id
   where coalesce(e.region_id, o.region_id) = p_region and e.status <> 'draft'
   order by e.starts_at desc limit 500;
end $$;

-- podnety: iba obsah a stav, bez totožnosti podávateľa
create function public.regional_complaints(p_region uuid) returns table (
  complaint_number text, subject text, status text, organization text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.region_access(p_region) then raise exception 'FORBIDDEN'; end if;
  return query
  select c.complaint_number, c.subject, c.status, o.name, c.created_at
    from public.complaints c join public.organizations o on o.id = c.target_org_id
   where o.region_id = p_region order by c.created_at desc limit 300;
end $$;

-- ============ SDZ AWARDS (iba architektúra; bez bodovania, prahov a automatiky) ============
create table public.award_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.volunteer_awards (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id),
  award_type_id uuid not null references public.award_types(id),
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 1000),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revoke_reason text
);
create unique index one_active_award on public.volunteer_awards (volunteer_id, award_type_id) where revoked_at is null;
create index awards_vol_idx on public.volunteer_awards (volunteer_id);
alter table public.award_types enable row level security;
alter table public.volunteer_awards enable row level security;
create policy award_types_select on public.award_types for select to authenticated using (true);
create policy volunteer_awards_select on public.volunteer_awards for select to authenticated
  using (volunteer_id = public.my_volunteer() or public.has_permission(auth.uid(), 'awards.manage')
         or public.has_permission(auth.uid(), 'volunteers.read.all'));
create trigger audit_award_types after insert or update on public.award_types for each row execute function public.audit_row();
create trigger audit_volunteer_awards after insert or update on public.volunteer_awards for each row execute function public.audit_row();

create function public.save_award_type(p_id uuid, p_name text, p_description text, p_active boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'awards.manage') then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_INPUT'; end if;
  if p_id is null then
    insert into public.award_types (name, description, active, created_by)
    values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_active, true), auth.uid()) returning id into v_id;
  else
    update public.award_types set name = trim(p_name), description = nullif(trim(coalesce(p_description, '')), ''), active = coalesce(p_active, active)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

-- ručné udelenie; žiadne automatické kritériá
create function public.grant_award(p_volunteer uuid, p_type uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_profile uuid; v_name text;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'awards.manage') then raise exception 'FORBIDDEN'; end if;
  select name into v_name from public.award_types where id = p_type and active;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  select profile_id into v_profile from public.volunteers where id = p_volunteer;
  if v_profile is null then raise exception 'NOT_FOUND'; end if;
  if v_profile = auth.uid() then raise exception 'SELF_CHANGE'; end if;
  begin
    insert into public.volunteer_awards (volunteer_id, award_type_id, granted_by, note)
    values (p_volunteer, p_type, auth.uid(), nullif(trim(coalesce(p_note, '')), '')) returning id into v_id;
  exception when unique_violation then raise exception 'ALREADY_EXISTS'; end;
  perform public.notify(v_profile, 'award.granted', 'Získali ste ocenenie SDZ', v_name, '/account/awards');
  return v_id;
end $$;

create function public.revoke_award(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'awards.manage') then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
  update public.volunteer_awards set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = trim(p_reason)
   where id = p_id and revoked_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
