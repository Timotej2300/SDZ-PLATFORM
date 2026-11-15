-- SDZ FÁZA 4: podujatia, SDZ Forms (verzované), prihlášky, tímy, pozície, pracovné zmeny
-- Zápis ide iba cez databázové funkcie (SECURITY DEFINER). Tabuľky majú RLS iba na čítanie.

-- ============ OPRÁVNENIA ============
insert into public.permissions (key, scope, description) values
  ('events.manage', 'organization', 'Vytváranie a úprava podujatí, tímov, pozícií a pracovných zmien'),
  ('forms.manage', 'organization', 'Správa dynamických formulárov'),
  ('applications.decide', 'organization', 'Rozhodovanie o prihláškach na podujatia a zaraďovanie'),
  ('events.consent', 'organization', 'Súhlas domovskej organizácie s prihláškou na cudzie podujatie'),
  ('events.read', 'system', 'Čítanie všetkých podujatí a prihlášok');

with m(role_key, perms) as (values
  ('org_owner', array['events.manage','forms.manage','applications.decide','events.consent']),
  ('org_chairman', array['events.manage','forms.manage','applications.decide','events.consent']),
  ('org_administrator', array['events.manage','forms.manage','applications.decide','events.consent']),
  ('org_vice_chairman', array['events.manage','forms.manage','applications.decide','events.consent']),
  ('org_volunteer_manager', array['applications.decide','events.consent']),
  ('org_event_manager', array['events.manage','forms.manage','applications.decide']),
  ('org_event_coordinator', array['events.manage','applications.decide']),
  ('president', array['events.read']),
  ('vice_president', array['events.read']),
  ('secretary_general', array['events.read']),
  ('admin', array['events.read']),
  ('auditor', array['events.read']),
  ('regional_manager', array['events.read']),
  ('verification_manager', array['events.read'])
)
insert into public.role_permissions (role_id, permission_key)
select r.id, p from m join public.roles r on r.key = m.role_key, unnest(m.perms) p;

-- ============ FORMULÁRE (verzované, verzie sú nemenné) ============
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 2 and 160),
  description text check (char_length(description) <= 1000),
  archived boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index forms_org_idx on public.forms (organization_id);
create trigger forms_updated before update on public.forms
  for each row execute function public.set_updated_at();

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id),
  version int not null check (version > 0),
  fields jsonb not null check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 40),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (form_id, version)
);
create trigger form_versions_immutable before update or delete on public.form_versions
  for each row execute function public.immutable_row();

-- ============ PODUJATIA ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 200),
  description text check (char_length(description) <= 8000),
  location text check (char_length(location) <= 300),
  region_id uuid references public.regions(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int check (capacity > 0),
  min_age int check (min_age between 0 and 120),
  max_age int check (max_age between 0 and 120),
  registration_deadline timestamptz,
  accommodation boolean not null default false,
  meals boolean not null default false,
  form_version_id uuid references public.form_versions(id),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (min_age is null or max_age is null or min_age <= max_age),
  check (registration_deadline is null or registration_deadline <= ends_at)
);
create index events_org_idx on public.events (organization_id, starts_at desc);
create index events_pub_idx on public.events (starts_at) where status = 'published';
create trigger events_updated before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 1000),
  capacity int check (capacity > 0),
  leader_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index event_teams_event_idx on public.event_teams (event_id);

create table public.event_positions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  team_id uuid references public.event_teams(id),
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 1000),
  capacity int check (capacity > 0),
  created_at timestamptz not null default now()
);
create index event_positions_event_idx on public.event_positions (event_id);

create table public.event_shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  team_id uuid references public.event_teams(id),
  position_id uuid references public.event_positions(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int check (capacity > 0),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index event_shifts_event_idx on public.event_shifts (event_id, starts_at);

-- ============ PRIHLÁŠKY ============
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  volunteer_id uuid not null references public.volunteers(id),
  status text not null default 'submitted' check (status in
    ('draft', 'submitted', 'in_review', 'needs_info', 'approved', 'assigned', 'rejected', 'cancelled')),
  home_org_id uuid references public.organizations(id),
  home_org_consent_status text not null default 'not_required'
    check (home_org_consent_status in ('not_required', 'pending', 'granted', 'denied')),
  home_org_consent_by uuid references public.profiles(id),
  home_org_consent_at timestamptz,
  home_org_consent_note text,
  form_version_id uuid references public.form_versions(id),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  message text check (char_length(message) <= 1000),
  team_id uuid references public.event_teams(id),
  position_id uuid references public.event_positions(id),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  decision_note text,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, volunteer_id)
);
create index applications_event_idx on public.applications (event_id, status);
create index applications_vol_idx on public.applications (volunteer_id);
create index applications_home_idx on public.applications (home_org_id) where home_org_consent_status = 'pending';
create trigger applications_updated before update on public.applications
  for each row execute function public.set_updated_at();

create function public.guard_application() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE'; end if;
  if current_setting('sdz.fn', true) is distinct from '1' then raise exception 'FORBIDDEN'; end if;
  if new.event_id is distinct from old.event_id or new.volunteer_id is distinct from old.volunteer_id then
    raise exception 'IMMUTABLE';
  end if;
  return new;
end $$;
create trigger applications_guard before update or delete on public.applications
  for each row execute function public.guard_application();

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  shift_id uuid not null references public.event_shifts(id),
  application_id uuid not null references public.applications(id),
  volunteer_id uuid not null references public.volunteers(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (shift_id, volunteer_id)
);
create index shift_assignments_vol_idx on public.shift_assignments (volunteer_id);
create index shift_assignments_app_idx on public.shift_assignments (application_id);

create trigger audit_forms after insert or update on public.forms for each row execute function public.audit_row();
create trigger audit_form_versions after insert on public.form_versions for each row execute function public.audit_row();
create trigger audit_events after insert or update or delete on public.events for each row execute function public.audit_row();
create trigger audit_event_teams after insert or update or delete on public.event_teams for each row execute function public.audit_row();
create trigger audit_event_positions after insert or update or delete on public.event_positions for each row execute function public.audit_row();
create trigger audit_event_shifts after insert or update or delete on public.event_shifts for each row execute function public.audit_row();
create trigger audit_applications after insert or update on public.applications for each row execute function public.audit_row();
create trigger audit_shift_assignments after insert or delete on public.shift_assignments for each row execute function public.audit_row();

-- ============ POMOCNÉ FUNKCIE ============
create function public.my_volunteer() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.volunteers where profile_id = auth.uid()
$$;

create function public.event_org(p_event uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.events where id = p_event
$$;

create function public.can_see_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and ((e.status = 'published'
            and exists (select 1 from public.organizations o where o.id = e.organization_id and o.status = 'approved'))
           or public.has_permission(auth.uid(), 'org.view', 'organization', e.organization_id)
           or public.has_permission(auth.uid(), 'events.read')))
$$;
grant execute on function public.can_see_event(uuid) to anon, authenticated;

-- personál organizácie udalosti (rozhodovanie, správa alebo dochádzka)
create function public.event_staff(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and (public.has_permission(auth.uid(), 'applications.decide', 'organization', e.organization_id)
           or public.has_permission(auth.uid(), 'events.manage', 'organization', e.organization_id)
           or public.has_permission(auth.uid(), 'attendance.write', 'organization', e.organization_id)))
$$;

-- rozšírenie viditeľnosti dobrovoľníka pre štáb organizátora podujatia
create or replace function public.staff_sees_volunteer(p_vol uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.organization_memberships m
      where m.volunteer_id = p_vol and m.status = 'active'
        and public.has_permission(auth.uid(), 'volunteers.read', 'organization', m.organization_id))
    or exists (
      select 1 from public.volunteer_guestings g
      where g.volunteer_id = p_vol and g.status in ('pending_host', 'active')
        and public.has_permission(auth.uid(), 'volunteers.read', 'organization', g.host_org_id))
    or exists (
      select 1 from public.volunteer_transfers t
      where t.volunteer_id = p_vol
        and (t.status = 'pending_target' or (t.status = 'overdue_review' and t.overdue_from = 'target'))
        and public.has_permission(auth.uid(), 'transfers.decide', 'organization', t.to_org_id))
    or exists (
      select 1 from public.applications a
      where a.volunteer_id = p_vol and a.status not in ('draft', 'cancelled')
        and public.event_staff(a.event_id))
$$;

-- vek podľa roku narodenia (uložený je iba rok): minimálny vek striktne, maximálny zhovievavo
create function public._age_ok(p_birth_year int, p_at timestamptz, p_min int, p_max int) returns boolean
language plpgsql stable as $$
declare v_diff int;
begin
  if p_min is null and p_max is null then return true; end if;
  if p_birth_year is null then return false; end if;
  v_diff := extract(year from p_at)::int - p_birth_year;
  if p_min is not null and v_diff < p_min + 1 then return false; end if;
  if p_max is not null and v_diff - 1 > p_max then return false; end if;
  return true;
end $$;

-- kontrola a očistenie odpovedí podľa definície polí
create function public._clean_answers(p_fields jsonb, p_answers jsonb) returns jsonb
language plpgsql stable as $$
declare f jsonb; v_id text; v_type text; v_val jsonb; v_txt text; v_out jsonb := '{}'::jsonb;
begin
  if p_fields is null then return '{}'::jsonb; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'FORM_INVALID'; end if;
  for f in select * from jsonb_array_elements(p_fields) loop
    v_id := f->>'id'; v_type := f->>'type'; v_val := p_answers->v_id;
    v_txt := case when v_val is null or jsonb_typeof(v_val) = 'null' then null
                  when jsonb_typeof(v_val) = 'string' then btrim(v_val #>> '{}')
                  else v_val #>> '{}' end;
    if v_type = 'checkbox' then
      if v_txt is not null and v_txt not in ('true', 'false') then raise exception 'FORM_INVALID'; end if;
      if coalesce((f->>'required')::boolean, false) and coalesce(v_txt, 'false') <> 'true' then raise exception 'FORM_INCOMPLETE'; end if;
      v_out := v_out || jsonb_build_object(v_id, coalesce(v_txt, 'false') = 'true');
      continue;
    end if;
    if v_txt is null or v_txt = '' then
      if coalesce((f->>'required')::boolean, false) then raise exception 'FORM_INCOMPLETE'; end if;
      continue;
    end if;
    if char_length(v_txt) > 2000 then raise exception 'FORM_INVALID'; end if;
    if v_type = 'number' then
      begin perform v_txt::numeric; exception when others then raise exception 'FORM_INVALID'; end;
      v_out := v_out || jsonb_build_object(v_id, v_txt::numeric);
    elsif v_type = 'select' then
      if not (f->'options') ? v_txt then raise exception 'FORM_INVALID'; end if;
      v_out := v_out || jsonb_build_object(v_id, v_txt);
    elsif v_type = 'date' then
      begin perform v_txt::date; exception when others then raise exception 'FORM_INVALID'; end;
      v_out := v_out || jsonb_build_object(v_id, v_txt);
    else
      v_out := v_out || jsonb_build_object(v_id, v_txt);
    end if;
  end loop;
  return v_out;
end $$;

-- ============ FORMULÁRE ============
create function public._validate_fields(p_fields jsonb) returns void
language plpgsql stable as $$
declare f jsonb; v_ids text[] := '{}'; v_id text; v_type text;
begin
  if p_fields is null or jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) > 40 then
    raise exception 'FORM_INVALID';
  end if;
  for f in select * from jsonb_array_elements(p_fields) loop
    if jsonb_typeof(f) <> 'object' then raise exception 'FORM_INVALID'; end if;
    v_id := f->>'id'; v_type := f->>'type';
    if v_id is null or v_id !~ '^[a-z][a-z0-9_]{0,39}$' or v_id = any (v_ids) then raise exception 'FORM_INVALID'; end if;
    v_ids := v_ids || v_id;
    if coalesce(char_length(f->>'label'), 0) not between 1 and 200 then raise exception 'FORM_INVALID'; end if;
    if v_type not in ('text', 'textarea', 'number', 'select', 'checkbox', 'date') then raise exception 'FORM_INVALID'; end if;
    if f ? 'required' and jsonb_typeof(f->'required') <> 'boolean' then raise exception 'FORM_INVALID'; end if;
    if v_type = 'select' and (jsonb_typeof(f->'options') <> 'array'
        or jsonb_array_length(f->'options') not between 2 and 30) then
      raise exception 'FORM_INVALID';
    end if;
  end loop;
end $$;

create function public.save_form(p_id uuid, p_org uuid, p_name text, p_description text, p_fields jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_ver int;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'forms.manage', 'organization', p_org) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.organizations where id = p_org and status = 'approved') then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  perform public._validate_fields(p_fields);
  if v_id is null then
    insert into public.forms (organization_id, name, description, created_by)
    values (p_org, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), auth.uid())
    returning id into v_id;
    v_ver := 1;
  else
    if not exists (select 1 from public.forms where id = v_id and organization_id = p_org) then
      raise exception 'NOT_FOUND';
    end if;
    update public.forms set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), '')
     where id = v_id;
    select coalesce(max(version), 0) + 1 into v_ver from public.form_versions where form_id = v_id;
  end if;
  insert into public.form_versions (form_id, version, fields, created_by) values (v_id, v_ver, p_fields, auth.uid());
  return v_id;
end $$;

create function public.archive_form(p_id uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.forms where id = p_id;
  if v_org is null then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'forms.manage', 'organization', v_org) then
    raise exception 'FORBIDDEN';
  end if;
  update public.forms set archived = p_archived where id = p_id;
end $$;

-- ============ PODUJATIA ============
create function public.save_event(
  p_id uuid, p_org uuid, p_slug text, p_title text, p_description text, p_location text, p_region uuid,
  p_starts timestamptz, p_ends timestamptz, p_capacity int, p_min_age int, p_max_age int,
  p_deadline timestamptz, p_accommodation boolean, p_meals boolean, p_form_version uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; e public.events%rowtype; v_taken int;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_id is not null then
    select * into e from public.events where id = p_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    p_org := e.organization_id;
  end if;
  if not public.has_permission(auth.uid(), 'events.manage', 'organization', p_org) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.organizations where id = p_org and status = 'approved') then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  if p_form_version is not null and not exists (
      select 1 from public.form_versions fv join public.forms f on f.id = fv.form_id
      where fv.id = p_form_version and f.organization_id = p_org and not f.archived) then
    raise exception 'INVALID';
  end if;

  if p_id is null then
    insert into public.events (organization_id, slug, title, description, location, region_id, starts_at, ends_at,
      capacity, min_age, max_age, registration_deadline, accommodation, meals, form_version_id, created_by)
    values (p_org, p_slug, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_location, '')), ''), p_region, p_starts, p_ends, p_capacity, p_min_age, p_max_age,
      p_deadline, coalesce(p_accommodation, false), coalesce(p_meals, false), p_form_version, auth.uid())
    returning id into v_id;
    return v_id;
  end if;

  if e.status = 'cancelled' then raise exception 'EVENT_CLOSED'; end if;
  select count(*) into v_taken from public.applications where event_id = p_id and status in ('approved', 'assigned');
  if p_capacity is not null and p_capacity < v_taken then raise exception 'CAPACITY_FULL'; end if;
  if p_form_version is distinct from e.form_version_id
     and exists (select 1 from public.applications where event_id = p_id and status <> 'cancelled') then
    raise exception 'FORM_LOCKED';
  end if;
  update public.events set
    title = btrim(p_title), description = nullif(btrim(coalesce(p_description, '')), ''),
    location = nullif(btrim(coalesce(p_location, '')), ''), region_id = p_region,
    starts_at = p_starts, ends_at = p_ends, capacity = p_capacity, min_age = p_min_age, max_age = p_max_age,
    registration_deadline = p_deadline, accommodation = coalesce(p_accommodation, false),
    meals = coalesce(p_meals, false), form_version_id = p_form_version
  where id = p_id;
  return v_id;
end $$;

create function public.set_event_published(p_id uuid, p_publish boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'events.manage', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.organizations where id = e.organization_id and status = 'approved') then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  if p_publish then
    if e.status <> 'draft' then raise exception 'INVALID_STATE'; end if;
    if e.ends_at <= now() then raise exception 'EVENT_CLOSED'; end if;
    update public.events set status = 'published' where id = p_id;
  else
    if e.status <> 'published' then raise exception 'INVALID_STATE'; end if;
    if exists (select 1 from public.applications where event_id = p_id and status <> 'cancelled') then
      raise exception 'HAS_APPLICATIONS';
    end if;
    update public.events set status = 'draft' where id = p_id;
  end if;
end $$;

create function public.cancel_event(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into e from public.events where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'events.manage', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then raise exception 'REASON_REQUIRED'; end if;
  if e.status = 'cancelled' then raise exception 'INVALID_STATE'; end if;
  perform set_config('sdz.fn', '1', true);
  update public.applications set status = 'cancelled', decision_note = 'Podujatie bolo zrušené: ' || v_reason,
         decided_at = now(), decided_by = auth.uid()
   where event_id = p_id and status in ('submitted', 'in_review', 'needs_info', 'approved', 'assigned');
  update public.events set status = 'cancelled' where id = p_id;
  perform public.audit_write('event.cancel', 'events', p_id::text, null, jsonb_build_object('reason', v_reason));
end $$;

create function public.delete_event(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'events.manage', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if e.status <> 'draft' or exists (select 1 from public.applications where event_id = p_id) then
    raise exception 'HAS_APPLICATIONS';
  end if;
  delete from public.event_shifts where event_id = p_id;
  delete from public.event_positions where event_id = p_id;
  delete from public.event_teams where event_id = p_id;
  delete from public.events where id = p_id;
end $$;

-- ============ TÍMY, POZÍCIE, ZMENY ============
create function public._event_manage_gate(p_event uuid) returns public.events
language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_event;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'events.manage', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.organizations where id = e.organization_id and status = 'approved') then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  if e.status = 'cancelled' then raise exception 'EVENT_CLOSED'; end if;
  return e;
end $$;
revoke execute on function public._event_manage_gate(uuid) from public, anon, authenticated;

create function public.save_team(p_id uuid, p_event uuid, p_name text, p_description text, p_capacity int, p_leader uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events; v_id uuid := p_id;
begin
  e := public._event_manage_gate(p_event);
  if p_leader is not null and not exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_leader and ur.scope_type = 'organization' and ur.scope_id = e.organization_id and ur.revoked_at is null) then
    raise exception 'INVALID';
  end if;
  if v_id is null then
    insert into public.event_teams (event_id, name, description, capacity, leader_profile_id)
    values (p_event, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_capacity, p_leader)
    returning id into v_id;
  else
    update public.event_teams set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), ''),
           capacity = p_capacity, leader_profile_id = p_leader
     where id = v_id and event_id = p_event;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

create function public.save_position(p_id uuid, p_event uuid, p_team uuid, p_name text, p_description text, p_capacity int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events; v_id uuid := p_id;
begin
  e := public._event_manage_gate(p_event);
  if p_team is not null and not exists (select 1 from public.event_teams where id = p_team and event_id = p_event) then
    raise exception 'INVALID';
  end if;
  if v_id is null then
    insert into public.event_positions (event_id, team_id, name, description, capacity)
    values (p_event, p_team, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_capacity)
    returning id into v_id;
  else
    update public.event_positions set team_id = p_team, name = btrim(p_name),
           description = nullif(btrim(coalesce(p_description, '')), ''), capacity = p_capacity
     where id = v_id and event_id = p_event;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

create function public.save_shift(
  p_id uuid, p_event uuid, p_team uuid, p_position uuid, p_starts timestamptz, p_ends timestamptz,
  p_capacity int, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events; v_id uuid := p_id;
begin
  e := public._event_manage_gate(p_event);
  if p_ends <= p_starts or p_starts < e.starts_at or p_ends > e.ends_at then raise exception 'INVALID_TIME'; end if;
  if p_team is not null and not exists (select 1 from public.event_teams where id = p_team and event_id = p_event) then
    raise exception 'INVALID';
  end if;
  if p_position is not null and not exists (select 1 from public.event_positions where id = p_position and event_id = p_event) then
    raise exception 'INVALID';
  end if;
  if v_id is null then
    insert into public.event_shifts (event_id, team_id, position_id, starts_at, ends_at, capacity, note)
    values (p_event, p_team, p_position, p_starts, p_ends, p_capacity, nullif(btrim(coalesce(p_note, '')), ''))
    returning id into v_id;
  else
    update public.event_shifts set team_id = p_team, position_id = p_position, starts_at = p_starts, ends_at = p_ends,
           capacity = p_capacity, note = nullif(btrim(coalesce(p_note, '')), '')
     where id = v_id and event_id = p_event;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

create function public.delete_event_item(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  if p_kind = 'team' then select event_id into v_event from public.event_teams where id = p_id;
  elsif p_kind = 'position' then select event_id into v_event from public.event_positions where id = p_id;
  elsif p_kind = 'shift' then select event_id into v_event from public.event_shifts where id = p_id;
  else raise exception 'INVALID'; end if;
  if v_event is null then raise exception 'NOT_FOUND'; end if;
  perform public._event_manage_gate(v_event);
  if p_kind = 'team' then
    if exists (select 1 from public.applications where team_id = p_id) then raise exception 'IN_USE'; end if;
    delete from public.event_teams where id = p_id;       -- porušenie FK (pozície/zmeny) = IN_USE
  elsif p_kind = 'position' then
    if exists (select 1 from public.applications where position_id = p_id) then raise exception 'IN_USE'; end if;
    delete from public.event_positions where id = p_id;
  else
    if exists (select 1 from public.shift_assignments where shift_id = p_id) then raise exception 'IN_USE'; end if;
    delete from public.event_shifts where id = p_id;
  end if;
end $$;

-- ============ PRIHLÁŠKY ============
create function public._open_for_applications(e public.events) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.status <> 'published' or e.ends_at <= now()
     or not exists (select 1 from public.organizations o where o.id = e.organization_id and o.status = 'approved') then
    raise exception 'EVENT_CLOSED';
  end if;
end $$;
revoke execute on function public._open_for_applications(public.events) from public, anon, authenticated;

create function public.apply_to_event(p_event uuid, p_answers jsonb, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v public.volunteers%rowtype; e public.events%rowtype; pr public.profiles%rowtype; ex public.applications%rowtype;
  v_fields jsonb; v_clean jsonb; v_id uuid; v_consent text; v_exists boolean;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select * into v from public.volunteers where profile_id = auth.uid();
  if not found then raise exception 'NOT_VOLUNTEER'; end if;
  if v.status <> 'active' then raise exception 'VOLUNTEER_INACTIVE'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._open_for_applications(e);
  if e.registration_deadline is not null and now() > e.registration_deadline then raise exception 'DEADLINE_PASSED'; end if;
  if not public.current_license_ok(v.id) then raise exception 'LICENSE_REQUIRED'; end if;
  select * into pr from public.profiles where id = v.profile_id;
  if not public._age_ok(pr.birth_year, e.starts_at, e.min_age, e.max_age) then raise exception 'AGE_NOT_ALLOWED'; end if;
  if v.home_organization_id is null then raise exception 'NO_MEMBERSHIP'; end if;

  select fv.fields into v_fields from public.form_versions fv where fv.id = e.form_version_id;
  v_clean := public._clean_answers(v_fields, coalesce(p_answers, '{}'::jsonb));
  v_consent := case when v.home_organization_id = e.organization_id then 'not_required' else 'pending' end;

  select * into ex from public.applications where event_id = p_event and volunteer_id = v.id for update;
  v_exists := found;
  perform set_config('sdz.fn', '1', true);
  if v_exists then
    if ex.status not in ('cancelled', 'draft') then raise exception 'ALREADY_APPLIED'; end if;
    update public.applications set status = 'submitted', home_org_id = v.home_organization_id,
           home_org_consent_status = v_consent, home_org_consent_by = null, home_org_consent_at = null,
           home_org_consent_note = null, form_version_id = e.form_version_id, answers = v_clean,
           message = nullif(btrim(coalesce(p_message, '')), ''), team_id = null, position_id = null,
           submitted_at = now(), decided_at = null, decided_by = null, decision_note = null, assigned_at = null
     where id = ex.id;
    return ex.id;
  end if;
  insert into public.applications (event_id, volunteer_id, status, home_org_id, home_org_consent_status,
    form_version_id, answers, message, submitted_at)
  values (p_event, v.id, 'submitted', v.home_organization_id, v_consent, e.form_version_id, v_clean,
    nullif(btrim(coalesce(p_message, '')), ''), now())
  returning id into v_id;
  return v_id;
end $$;

create function public.resubmit_application(p_app uuid, p_answers jsonb, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.applications%rowtype; e public.events%rowtype; v_fields jsonb;
begin
  select * into a from public.applications where id = p_app for update;
  if not found or a.volunteer_id is distinct from public.my_volunteer() then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'needs_info' then raise exception 'INVALID_STATE'; end if;
  select * into e from public.events where id = a.event_id;
  perform public._open_for_applications(e);
  if not public.current_license_ok(a.volunteer_id) then raise exception 'LICENSE_REQUIRED'; end if;
  select fv.fields into v_fields from public.form_versions fv where fv.id = a.form_version_id;
  perform set_config('sdz.fn', '1', true);
  update public.applications set answers = public._clean_answers(v_fields, coalesce(p_answers, '{}'::jsonb)),
         message = nullif(btrim(coalesce(p_message, '')), ''), status = 'in_review'
   where id = p_app;
end $$;

create function public.cancel_application(p_app uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.applications%rowtype;
begin
  select * into a from public.applications where id = p_app for update;
  if not found or a.volunteer_id is distinct from public.my_volunteer() then raise exception 'NOT_FOUND'; end if;
  if a.status not in ('submitted', 'in_review', 'needs_info', 'approved', 'assigned') then raise exception 'INVALID_STATE'; end if;
  perform set_config('sdz.fn', '1', true);
  delete from public.shift_assignments where application_id = p_app;
  update public.applications set status = 'cancelled', team_id = null, position_id = null, assigned_at = null where id = p_app;
end $$;

-- súhlas domovskej organizácie (cudzie podujatie)
create function public.decide_home_consent(p_app uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.applications%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into a from public.applications where id = p_app for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or a.home_org_id is null
     or not public.has_permission(auth.uid(), 'events.consent', 'organization', a.home_org_id) then
    raise exception 'FORBIDDEN';
  end if;
  if a.home_org_consent_status <> 'pending' or a.status not in ('submitted', 'in_review', 'needs_info') then
    raise exception 'INVALID_STATE';
  end if;
  if p_decision = 'grant' then
    perform set_config('sdz.fn', '1', true);
    update public.applications set home_org_consent_status = 'granted', home_org_consent_by = auth.uid(),
           home_org_consent_at = now(), home_org_consent_note = v_note where id = p_app;
  elsif p_decision = 'deny' then
    if v_note is null or char_length(v_note) < 3 then raise exception 'REASON_REQUIRED'; end if;
    perform set_config('sdz.fn', '1', true);
    update public.applications set home_org_consent_status = 'denied', home_org_consent_by = auth.uid(),
           home_org_consent_at = now(), home_org_consent_note = v_note, status = 'rejected',
           decided_at = now(), decided_by = auth.uid(), decision_note = 'Domovská organizácia nesúhlasila: ' || v_note
     where id = p_app;
  else
    raise exception 'INVALID';
  end if;
end $$;

create function public.list_consent_requests(p_org uuid)
returns table (app_id uuid, event_title text, event_org text, event_starts timestamptz,
               volunteer_name text, consent text, submitted timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'events.consent', 'organization', p_org) then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select a.id, e.title, o.name, e.starts_at, p.first_name || ' ' || p.last_name,
           a.home_org_consent_status, a.submitted_at
      from public.applications a
      join public.events e on e.id = a.event_id
      join public.organizations o on o.id = e.organization_id
      join public.volunteers v on v.id = a.volunteer_id
      join public.profiles p on p.id = v.profile_id
     where a.home_org_id = p_org and a.home_org_consent_status <> 'not_required' and a.status <> 'cancelled'
     order by (a.home_org_consent_status = 'pending') desc, a.submitted_at desc
     limit 200;
end $$;

-- rozhodnutie organizátora o prihláške
create function public.review_application(p_app uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.applications%rowtype; e public.events%rowtype; v public.volunteers%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_new text; v_taken int;
begin
  select * into a from public.applications where id = p_app for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into e from public.events where id = a.event_id;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'applications.decide', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.organizations where id = e.organization_id and status = 'approved') then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  if e.status = 'cancelled' then raise exception 'EVENT_CLOSED'; end if;

  if p_decision = 'start_review' and a.status = 'submitted' then v_new := 'in_review';
  elsif p_decision = 'request_info' and a.status in ('submitted', 'in_review') then v_new := 'needs_info';
  elsif p_decision = 'approve' and a.status in ('submitted', 'in_review') then v_new := 'approved';
  elsif p_decision = 'reject' and a.status in ('submitted', 'in_review', 'needs_info') then v_new := 'rejected';
  else raise exception 'INVALID_STATE';
  end if;
  if p_decision in ('request_info', 'reject') and (v_note is null or char_length(v_note) < 3) then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_decision in ('start_review', 'approve') and a.home_org_consent_status not in ('not_required', 'granted') then
    raise exception 'CONSENT_REQUIRED';
  end if;
  if p_decision = 'approve' then
    select * into v from public.volunteers where id = a.volunteer_id;
    if v.status <> 'active' then raise exception 'VOLUNTEER_INACTIVE'; end if;
    if not public.current_license_ok(a.volunteer_id) then raise exception 'LICENSE_REQUIRED'; end if;
    select count(*) into v_taken from public.applications where event_id = e.id and status in ('approved', 'assigned');
    if e.capacity is not null and v_taken >= e.capacity then raise exception 'CAPACITY_FULL'; end if;
  end if;

  perform set_config('sdz.fn', '1', true);
  update public.applications set status = v_new, decision_note = v_note,
         decided_at = case when v_new <> 'in_review' then now() end,
         decided_by = case when v_new <> 'in_review' then auth.uid() end
   where id = p_app;
end $$;

-- zaradenie do tímu, na pozíciu a do zmien
create function public.assign_application(p_app uuid, p_team uuid, p_position uuid, p_shifts uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.applications%rowtype; e public.events%rowtype; s uuid; v_n int; v_cap int;
begin
  select * into a from public.applications where id = p_app for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into e from public.events where id = a.event_id;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'applications.decide', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.organizations where id = e.organization_id and status = 'approved') then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  if e.status = 'cancelled' then raise exception 'EVENT_CLOSED'; end if;
  if a.status not in ('approved', 'assigned') then raise exception 'INVALID_STATE'; end if;
  -- nové pridelenie vyžaduje platnú licenciu (výnimka pre už začaté podujatie platí iba pre dochádzku)
  if not public.current_license_ok(a.volunteer_id) then raise exception 'LICENSE_REQUIRED'; end if;

  if p_team is not null then
    if not exists (select 1 from public.event_teams where id = p_team and event_id = e.id) then raise exception 'INVALID'; end if;
    select capacity into v_cap from public.event_teams where id = p_team;
    select count(*) into v_n from public.applications where team_id = p_team and id <> p_app and status = 'assigned';
    if v_cap is not null and v_n >= v_cap then raise exception 'CAPACITY_FULL'; end if;
  end if;
  if p_position is not null then
    if not exists (select 1 from public.event_positions where id = p_position and event_id = e.id
                   and (team_id is null or team_id is not distinct from p_team)) then
      raise exception 'INVALID';
    end if;
    select capacity into v_cap from public.event_positions where id = p_position;
    select count(*) into v_n from public.applications where position_id = p_position and id <> p_app and status = 'assigned';
    if v_cap is not null and v_n >= v_cap then raise exception 'CAPACITY_FULL'; end if;
  end if;

  delete from public.shift_assignments where application_id = p_app
    and (p_shifts is null or shift_id <> all (p_shifts));
  foreach s in array coalesce(p_shifts, '{}'::uuid[]) loop
    if not exists (select 1 from public.event_shifts where id = s and event_id = e.id) then raise exception 'INVALID'; end if;
    if exists (select 1 from public.shift_assignments where shift_id = s and application_id = p_app) then continue; end if;
    select capacity into v_cap from public.event_shifts where id = s;
    select count(*) into v_n from public.shift_assignments where shift_id = s;
    if v_cap is not null and v_n >= v_cap then raise exception 'CAPACITY_FULL'; end if;
    insert into public.shift_assignments (event_id, shift_id, application_id, volunteer_id, created_by)
    values (e.id, s, p_app, a.volunteer_id, auth.uid());
  end loop;

  perform set_config('sdz.fn', '1', true);
  update public.applications set status = 'assigned', team_id = p_team, position_id = p_position,
         assigned_at = coalesce(assigned_at, now())
   where id = p_app;
end $$;

create function public.unassign_application(p_app uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.applications%rowtype; e public.events%rowtype;
begin
  select * into a from public.applications where id = p_app for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into e from public.events where id = a.event_id;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'applications.decide', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if a.status <> 'assigned' then raise exception 'INVALID_STATE'; end if;
  perform set_config('sdz.fn', '1', true);
  delete from public.shift_assignments where application_id = p_app;
  update public.applications set status = 'approved', team_id = null, position_id = null, assigned_at = null where id = p_app;
end $$;

-- ============ RLS ============
alter table public.forms enable row level security;
alter table public.form_versions enable row level security;
alter table public.events enable row level security;
alter table public.event_teams enable row level security;
alter table public.event_positions enable row level security;
alter table public.event_shifts enable row level security;
alter table public.applications enable row level security;
alter table public.shift_assignments enable row level security;
revoke all on public.forms, public.form_versions, public.events, public.event_teams, public.event_positions,
  public.event_shifts, public.applications, public.shift_assignments from anon;
grant select on public.events to anon;
revoke insert, update, delete on public.forms, public.form_versions, public.events, public.event_teams,
  public.event_positions, public.event_shifts, public.applications, public.shift_assignments from authenticated, anon;

create policy events_select on public.events for select to anon, authenticated
  using (public.can_see_event(id));
create policy event_teams_select on public.event_teams for select to authenticated
  using (public.can_see_event(event_id));
create policy event_positions_select on public.event_positions for select to authenticated
  using (public.can_see_event(event_id));
create policy event_shifts_select on public.event_shifts for select to authenticated
  using (public.can_see_event(event_id));

create policy forms_select on public.forms for select to authenticated
  using (public.has_permission(auth.uid(), 'org.view', 'organization', organization_id)
         or public.has_permission(auth.uid(), 'events.read'));
create policy form_versions_select on public.form_versions for select to authenticated
  using (form_id in (select id from public.forms)
         or exists (select 1 from public.events e where e.form_version_id = form_versions.id and public.can_see_event(e.id)));

create policy applications_select on public.applications for select to authenticated
  using (volunteer_id = public.my_volunteer()
         or public.event_staff(event_id)
         or public.has_permission(auth.uid(), 'events.read'));
create policy shift_assignments_select on public.shift_assignments for select to authenticated
  using (volunteer_id = public.my_volunteer()
         or public.event_staff(event_id)
         or public.has_permission(auth.uid(), 'events.read'));

-- člen (dobrovoľník) vidí svoju domovskú organizáciu (názov v účte a v prihláškach)
create policy org_select_member on public.organizations for select to authenticated
  using (exists (select 1 from public.organization_memberships m
                 where m.organization_id = organizations.id and m.volunteer_id = public.my_volunteer()));
