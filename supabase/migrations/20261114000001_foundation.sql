-- SDZ FÁZA 1: základ (regióny, profily, RBAC, audit, ochrana Foundera, rate limit)

create extension if not exists pgcrypto with schema extensions;

create type public.role_scope as enum ('system', 'region', 'organization', 'event');

-- ============ REGIÓNY ============
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text unique not null,
  created_at timestamptz not null default now()
);
create table public.districts (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  name text not null,
  unique (region_id, name)
);

-- ============ PROFILY ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  birth_year int check (birth_year between 1900 and 2100),
  avatar_path text,
  phone text check (phone is null or char_length(phone) <= 30),
  language text not null default 'sk' check (language in ('sk', 'cs', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- e-mail a id sa z klienta meniť nesmú
create function public.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if current_setting('sdz.fn', true) is distinct from '1' then
    new.id := old.id;
    new.email := old.email;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- profil vzniká automaticky po registrácii v Supabase Auth
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  y int;
begin
  begin y := (m->>'birth_year')::int; exception when others then y := null; end;
  insert into public.profiles (id, email, first_name, last_name, birth_year)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(trim(m->>'first_name'), ''), 'Používateľ'), 80),
    left(coalesce(nullif(trim(m->>'last_name'), ''), '—'), 80),
    case when y between 1900 and 2100 then y end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sdz.fn', '1', true);
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- ============ RBAC ============
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null check (key ~ '^[a-z][a-z_]*$'),
  name text not null,
  scope public.role_scope not null,
  is_system boolean not null default false,
  is_protected boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.permissions (
  key text primary key,
  description text not null,
  scope public.role_scope not null
);
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  role_id uuid not null references public.roles(id),
  scope_type public.role_scope not null,
  scope_id uuid,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((scope_type = 'system' and scope_id is null) or (scope_type <> 'system' and scope_id is not null))
);
create unique index user_roles_unique_active on public.user_roles
  (user_id, role_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;
create index user_roles_user_idx on public.user_roles (user_id) where revoked_at is null;
create index user_roles_scope_idx on public.user_roles (scope_type, scope_id) where revoked_at is null;

-- ============ SYSTÉMOVÉ NASTAVENIA ============
create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- ============ AUDIT (append-only) ============
create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb
);
create index audit_logs_at_idx on public.audit_logs (at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create function public.audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'AUDIT_IMMUTABLE';
end $$;
create trigger audit_no_change before update or delete on public.audit_logs
  for each row execute function public.audit_immutable();

create function public.audit_write(
  p_action text, p_entity text, p_entity_id text,
  p_old jsonb default null, p_new jsonb default null, p_severity text default 'info'
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, severity, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), p_severity, p_action, p_entity, p_entity_id, p_old, p_new);
end $$;
revoke execute on function public.audit_write(text, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- všeobecný riadkový audit
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_data)
    values (auth.uid(), tg_table_name || '.delete', tg_table_name, to_jsonb(old)->>'id', to_jsonb(old));
    return old;
  elsif tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
    values (auth.uid(), tg_table_name || '.insert', tg_table_name, to_jsonb(new)->>'id', to_jsonb(new));
    return new;
  else
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
    values (auth.uid(), tg_table_name || '.update', tg_table_name, to_jsonb(new)->>'id', to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end $$;
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row();
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.audit_row();
create trigger audit_role_permissions after insert or delete on public.role_permissions
  for each row execute function public.audit_row();
create trigger audit_system_settings after insert or update or delete on public.system_settings
  for each row execute function public.audit_row();

-- ============ RATE LIMIT ============
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,
  at timestamptz not null default now()
);
create index rate_limit_key_idx on public.rate_limit_events (key, at);
alter table public.rate_limit_events enable row level security;

create function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if random() < 0.02 then
    delete from public.rate_limit_events where at < now() - interval '1 day';
  end if;
  select count(*) into v from public.rate_limit_events
   where key = p_key and at > now() - make_interval(secs => p_window_seconds);
  if v >= p_limit then return false; end if;
  insert into public.rate_limit_events (key) values (p_key);
  return true;
end $$;
grant execute on function public.rate_limit_hit(text, int, int) to anon, authenticated;

-- ============ OPRÁVNENIA ============
create function public.is_founder(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.key = 'founder' and ur.revoked_at is null
  )
$$;

create function public.has_permission(
  p_user uuid, p_key text,
  p_scope public.role_scope default 'system', p_scope_id uuid default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_user is null then false
    when auth.uid() is not null and p_user <> auth.uid() then false
    when public.is_founder(p_user) then true
    else exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = p_user and ur.revoked_at is null and rp.permission_key = p_key
        and (ur.scope_type = 'system'
             or (ur.scope_type = p_scope and ur.scope_id is not distinct from p_scope_id))
    )
  end
$$;

create function public.my_permission(
  p_key text, p_scope public.role_scope default 'system', p_scope_id uuid default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission(auth.uid(), p_key, p_scope, p_scope_id)
$$;

create function public.i_am_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_founder(auth.uid())
$$;

-- ============ OCHRANA FOUNDERA ============
create function public.protect_founder() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_fid uuid;
  v_caller uuid := auth.uid();
begin
  select id into v_fid from public.roles where key = 'founder';
  if v_fid is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.role_id = v_fid then
      if exists (select 1 from public.user_roles where role_id = v_fid and revoked_at is null) then
        if v_caller is null or not public.is_founder(v_caller) then
          raise exception 'FOUNDER_PROTECTED';
        end if;
      elsif v_caller is not null then
        raise exception 'FOUNDER_PROTECTED';  -- prvý Founder iba cez SQL (founder_bootstrap)
      end if;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if (old.role_id = v_fid or new.role_id = v_fid) and v_caller is not null then
      raise exception 'FOUNDER_PROTECTED';
    end if;
    return new;
  else
    if old.role_id = v_fid and v_caller is not null then
      raise exception 'FOUNDER_PROTECTED';
    end if;
    return old;
  end if;
end $$;
create trigger user_roles_protect_founder before insert or update or delete on public.user_roles
  for each row execute function public.protect_founder();

-- prvý Founder: spúšťa sa iba v SQL editore / z databázy, nie z aplikácie
create function public.founder_bootstrap(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_role uuid;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  select id into v_user from public.profiles where lower(email) = lower(p_email);
  if v_user is null then raise exception 'USER_NOT_FOUND'; end if;
  select id into v_role from public.roles where key = 'founder';
  insert into public.user_roles (user_id, role_id, scope_type) values (v_user, v_role, 'system');
  perform public.audit_write('founder.bootstrap', 'user_roles', v_user::text, null,
                             jsonb_build_object('email', p_email), 'critical');
end $$;
revoke execute on function public.founder_bootstrap(text) from public, anon, authenticated;

-- ============ PRIDEĽOVANIE ROLÍ ============
create function public.grant_role(
  p_email text, p_role_key text, p_scope_type public.role_scope, p_scope_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_role public.roles%rowtype;
  v_user uuid;
  v_id uuid;
begin
  if v_caller is null then raise exception 'FORBIDDEN'; end if;
  select * into v_role from public.roles where key = p_role_key;
  if not found then raise exception 'INVALID'; end if;
  if v_role.scope <> p_scope_type then raise exception 'INVALID'; end if;
  if v_role.is_protected then raise exception 'FOUNDER_PROTECTED'; end if;

  if p_scope_type = 'organization' then
    if p_scope_id is null then raise exception 'INVALID'; end if;
    if not public.has_permission(v_caller, 'org.staff.manage', 'organization', p_scope_id) then
      raise exception 'FORBIDDEN';
    end if;
    if p_role_key = 'org_owner' and not (
      public.is_founder(v_caller) or exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = v_caller and r.key = 'org_owner'
          and ur.scope_id = p_scope_id and ur.revoked_at is null)
    ) then
      raise exception 'FORBIDDEN';
    end if;
  else
    if not public.is_founder(v_caller) then raise exception 'FORBIDDEN'; end if;
  end if;

  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_user = v_caller then raise exception 'SELF_CHANGE'; end if;

  begin
    insert into public.user_roles (user_id, role_id, scope_type, scope_id, granted_by)
    values (v_user, v_role.id, p_scope_type, p_scope_id, v_caller)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE';
  end;

  perform public.audit_write('role.granted', 'user_roles', v_id::text, null,
    jsonb_build_object('user', v_user, 'role', p_role_key, 'scope', p_scope_type, 'scope_id', p_scope_id),
    case when p_scope_type = 'system' then 'critical' else 'info' end);
  return v_id;
end $$;

create function public.revoke_role(p_user_role_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_ur public.user_roles%rowtype;
  v_key text;
begin
  if v_caller is null then raise exception 'FORBIDDEN'; end if;
  select * into v_ur from public.user_roles where id = p_user_role_id and revoked_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;
  select key into v_key from public.roles where id = v_ur.role_id;
  if v_key = 'founder' then raise exception 'FOUNDER_PROTECTED'; end if;
  if v_ur.user_id = v_caller then raise exception 'SELF_CHANGE'; end if;

  if v_ur.scope_type = 'organization' then
    if not public.has_permission(v_caller, 'org.staff.manage', 'organization', v_ur.scope_id) then
      raise exception 'FORBIDDEN';
    end if;
    if v_key = 'org_owner' and not (
      public.is_founder(v_caller) or exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = v_caller and r.key = 'org_owner'
          and ur.scope_id = v_ur.scope_id and ur.revoked_at is null)
    ) then
      raise exception 'FORBIDDEN';
    end if;
    if v_key = 'org_owner' and (
      select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id
      where r.key = 'org_owner' and ur.scope_id = v_ur.scope_id and ur.revoked_at is null) <= 1 then
      raise exception 'LAST_OWNER';
    end if;
  else
    if not public.is_founder(v_caller) then raise exception 'FORBIDDEN'; end if;
  end if;

  update public.user_roles set revoked_at = now() where id = p_user_role_id;
  perform public.audit_write('role.revoked', 'user_roles', p_user_role_id::text,
    jsonb_build_object('role', v_key, 'user', v_ur.user_id), null,
    case when v_ur.scope_type = 'system' then 'critical' else 'info' end);
end $$;

-- ============ FOUNDER: ROLE, OPRÁVNENIA, NASTAVENIA ============
create function public.create_role(p_key text, p_name text, p_scope public.role_scope) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_founder(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  if p_key in ('founder') then raise exception 'FOUNDER_PROTECTED'; end if;
  insert into public.roles (key, name, scope) values (p_key, trim(p_name), p_scope) returning id into v_id;
  perform public.audit_write('role.created', 'roles', v_id::text, null,
    jsonb_build_object('key', p_key, 'scope', p_scope), 'critical');
  return v_id;
exception when unique_violation then
  raise exception 'DUPLICATE';
end $$;

create function public.set_role_permissions(p_role_key text, p_keys text[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_role public.roles%rowtype;
begin
  if not public.is_founder(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  select * into v_role from public.roles where key = p_role_key;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_role.is_protected then raise exception 'FOUNDER_PROTECTED'; end if;
  if exists (select 1 from unnest(p_keys) k where not exists
      (select 1 from public.permissions p where p.key = k and p.scope = v_role.scope)) then
    raise exception 'INVALID';
  end if;
  delete from public.role_permissions where role_id = v_role.id;
  insert into public.role_permissions (role_id, permission_key)
    select v_role.id, k from unnest(p_keys) k;
  perform public.audit_write('role.permissions_set', 'roles', v_role.id::text, null,
    jsonb_build_object('role', p_role_key, 'permissions', to_jsonb(p_keys)), 'critical');
end $$;

create function public.set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_founder(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  update public.system_settings set value = p_value, updated_by = auth.uid(), updated_at = now()
   where key = p_key;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- ============ KONTEXT PRIHLÁSENÉHO POUŽÍVATEĽA ============
create function public.my_context() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'is_founder', public.is_founder(auth.uid()),
    'system_roles', coalesce((
      select jsonb_agg(distinct r.key) from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and ur.revoked_at is null and ur.scope_type = 'system'), '[]'::jsonb),
    'orgs', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status, 'roles', x.roles))
      from (
        select ur.scope_id, jsonb_agg(r.key) as roles
        from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and ur.revoked_at is null and ur.scope_type = 'organization'
        group by ur.scope_id
      ) x join public.organizations o on o.id = x.scope_id), '[]'::jsonb),
    'volunteer_id', (select v.id from public.volunteers v where v.profile_id = auth.uid())
  );
end $$;

-- ============ RLS ============
alter table public.regions enable row level security;
alter table public.districts enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy regions_read on public.regions for select to anon, authenticated using (true);
create policy regions_write on public.regions for all to authenticated
  using (public.has_permission(auth.uid(), 'regions.manage'))
  with check (public.has_permission(auth.uid(), 'regions.manage'));
create policy districts_read on public.districts for select to anon, authenticated using (true);
create policy districts_write on public.districts for all to authenticated
  using (public.has_permission(auth.uid(), 'regions.manage'))
  with check (public.has_permission(auth.uid(), 'regions.manage'));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission(auth.uid(), 'users.read'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

create policy user_roles_select on public.user_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission(auth.uid(), 'roles.read')
    or (scope_type = 'organization' and public.has_permission(auth.uid(), 'org.view', 'organization', scope_id))
  );

create policy settings_select on public.system_settings for select to authenticated
  using (is_public or public.has_permission(auth.uid(), 'settings.write'));

create policy audit_select on public.audit_logs for select to authenticated
  using (public.has_permission(auth.uid(), 'audit.read'));

-- ============ ÚLOŽISKO: AVATARY ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_own on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.has_permission(auth.uid(), 'users.read'));
