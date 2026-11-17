-- SDZ: správa modulov (vypínanie) a vizuálna identita (Founder)

create table public.system_modules (
  key text primary key,
  name text not null,
  description text,
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.system_modules enable row level security;
create policy modules_select on public.system_modules for select to authenticated using (true);
create trigger audit_system_modules after update on public.system_modules
  for each row execute function public.audit_row();

insert into public.system_modules (key, name, description) values
  ('events', 'Podujatia a prihlášky', 'Vytváranie podujatí a prihlasovanie dobrovoľníkov'),
  ('complaints', 'SDZ Complaints', 'Podávanie nových sťažností'),
  ('awards', 'SDZ Awards', 'Udeľovanie ocenení'),
  ('announcements', 'Systémové oznamy', 'Publikovanie nových oznamov'),
  ('regional', 'Regionálna administrácia', 'Portál regionálnych manažérov');

create function public.module_enabled(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.system_modules where key = p_key), true)
$$;

create function public.set_module(p_key text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_founder(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  update public.system_modules set enabled = p_enabled, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.audit_write('module.' || case when p_enabled then 'enabled' else 'disabled' end, 'system_modules', p_key, null,
    jsonb_build_object('enabled', p_enabled), 'warning');
end $$;

-- vypnutý modul zablokuje NOVÉ záznamy; existujúce údaje a história zostávajú
create function public.guard_module() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.module_enabled(tg_argv[0]) then raise exception 'MODULE_DISABLED'; end if;
  return new;
end $$;
create trigger events_module before insert on public.events for each row execute function public.guard_module('events');
create trigger applications_module before insert on public.applications for each row execute function public.guard_module('events');
create trigger complaints_module before insert on public.complaints for each row execute function public.guard_module('complaints');
create trigger awards_module before insert on public.volunteer_awards for each row execute function public.guard_module('awards');
create trigger announcements_module before insert on public.announcements for each row execute function public.guard_module('announcements');

create or replace function public.region_access(p_region uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and p_region is not null and public.module_enabled('regional') and (
    public.has_permission(auth.uid(), 'orgs.read')
    or exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
       where ur.user_id = auth.uid() and ur.revoked_at is null and r.key = 'regional_manager'
         and ur.scope_type = 'region' and ur.scope_id = p_region))
$$;

create or replace function public.my_regions() returns table (id uuid, code text, name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.code, r.name from public.regions r
   where auth.uid() is not null and public.module_enabled('regional') and (
     public.has_permission(auth.uid(), 'orgs.read')
     or exists (select 1 from public.user_roles ur join public.roles ro on ro.id = ur.role_id
                 where ur.user_id = auth.uid() and ur.revoked_at is null and ro.key = 'regional_manager'
                   and ur.scope_type = 'region' and ur.scope_id = r.id))
   order by r.name
$$;

-- ============ VIZUÁLNA IDENTITA ============
insert into public.system_settings (key, value, description, is_public) values
  ('brand.name', '"Slovenský dobrovoľnícky zväz"', 'Názov zobrazený v hlavičke a pätičke', true),
  ('brand.short', '"SDZ"', 'Skratka v logu (1–4 znaky)', true),
  ('brand.tagline', '"SDZ – Jedno miesto pre všetkých, ktorí chcú pomáhať."', 'Slogan v pätičke', true)
on conflict (key) do nothing;

create function public.public_branding() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(replace(key, 'brand.', ''), value), '{}'::jsonb)
    from public.system_settings where key like 'brand.%'
$$;
grant execute on function public.public_branding() to anon, authenticated;

create function public.save_branding(p_name text, p_short text, p_tagline text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_founder(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(p_name)) not between 2 and 80 or char_length(trim(p_short)) not between 1 and 4
     or char_length(trim(p_tagline)) > 160 then raise exception 'INVALID_INPUT'; end if;
  perform public.set_setting('brand.name', to_jsonb(trim(p_name)));
  perform public.set_setting('brand.short', to_jsonb(upper(trim(p_short))));
  perform public.set_setting('brand.tagline', to_jsonb(trim(p_tagline)));
end $$;
