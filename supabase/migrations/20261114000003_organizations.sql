-- SDZ FÁZA 2: organizácie, žiadosti, dokumenty

create type public.org_status as enum
  ('draft', 'submitted', 'in_review', 'needs_info', 'approved', 'rejected', 'suspended', 'cancelled');

create sequence public.org_number_seq;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  org_number text unique check (org_number ~ '^SDZ-O-\d{5}$'),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 160),
  type text not null check (type in ('civic_association','nonprofit','foundation','school','community_center','festival_organizer','other')),
  description text check (description is null or char_length(description) <= 4000),
  address text check (address is null or char_length(address) <= 300),
  ico text check (ico is null or ico ~ '^\d{6,8}$'),
  region_id uuid references public.regions(id),
  district_id uuid references public.districts(id),
  website text check (website is null or website ~* '^https?://'),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  logo_path text,
  status public.org_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organizations_status_idx on public.organizations (status);
create index organizations_region_idx on public.organizations (region_id);

create table public.organization_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  coordinator_id uuid not null references public.profiles(id),
  status public.org_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  decision_note text
);
create index org_apps_org_idx on public.organization_applications (organization_id, submitted_at desc);

create table public.organization_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  kind text not null check (kind in ('registration', 'statute', 'identity', 'other')),
  file_name text not null check (char_length(file_name) <= 200),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index org_docs_org_idx on public.organization_documents (organization_id);

-- chránené stĺpce sa dajú meniť iba cez databázové funkcie
create function public.guard_org_update() returns trigger
language plpgsql as $$
begin
  if current_setting('sdz.fn', true) is distinct from '1' then
    if new.status is distinct from old.status
       or new.org_number is distinct from old.org_number
       or new.created_by is distinct from old.created_by
       or new.slug is distinct from old.slug then
      raise exception 'FORBIDDEN';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger organizations_guard before update on public.organizations
  for each row execute function public.guard_org_update();
create trigger audit_organizations after insert or update on public.organizations
  for each row execute function public.audit_row();
create trigger audit_org_docs after insert or delete on public.organization_documents
  for each row execute function public.audit_row();

-- ============ FUNKCIE ============
-- Založenie návrhu organizácie: tvorca sa stáva Organization Ownerom
create function public.create_organization(p_name text, p_type text, p_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  perform set_config('sdz.fn', '1', true);
  insert into public.organizations (name, type, slug, created_by)
  values (trim(p_name), p_type, p_slug, auth.uid()) returning id into v_id;
  select id into v_role from public.roles where key = 'org_owner';
  insert into public.user_roles (user_id, role_id, scope_type, scope_id, granted_by)
  values (auth.uid(), v_role, 'organization', v_id, auth.uid());
  return v_id;
exception when unique_violation then
  raise exception 'DUPLICATE';
end $$;

-- Odoslanie žiadosti na schválenie
create function public.submit_organization(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.organizations%rowtype; p public.profiles%rowtype;
begin
  if auth.uid() is null
     or not public.has_permission(auth.uid(), 'org.manage', 'organization', p_org) then
    raise exception 'FORBIDDEN';
  end if;
  select * into o from public.organizations where id = p_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('draft', 'needs_info') then raise exception 'INVALID_STATE'; end if;
  if o.region_id is null or o.address is null or o.contact_email is null or o.description is null then
    raise exception 'ORG_INCOMPLETE';
  end if;
  if not exists (select 1 from public.organization_documents where organization_id = p_org) then
    raise exception 'ORG_NO_DOCUMENTS';
  end if;
  -- evidujeme iba rok narodenia: rozdiel >= 21 zaručuje vek aspoň 20 rokov
  select * into p from public.profiles where id = auth.uid();
  if p.birth_year is null or extract(year from current_date)::int - p.birth_year < 21 then
    raise exception 'COORDINATOR_AGE';
  end if;
  perform set_config('sdz.fn', '1', true);
  update public.organizations set status = 'submitted' where id = p_org;
  insert into public.organization_applications (organization_id, coordinator_id) values (p_org, auth.uid());
  perform public.audit_write('organization.submitted', 'organizations', p_org::text);
end $$;

-- Rozhodnutie SDZ o žiadosti
create function public.review_organization(p_org uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o public.organizations%rowtype; v_new public.org_status; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'orgs.review') then
    raise exception 'FORBIDDEN';
  end if;
  select * into o from public.organizations where id = p_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_decision = 'start_review' and o.status = 'submitted' then v_new := 'in_review';
  elsif p_decision = 'request_info' and o.status in ('submitted', 'in_review') then v_new := 'needs_info';
  elsif p_decision = 'approve' and o.status in ('submitted', 'in_review') then v_new := 'approved';
  elsif p_decision = 'reject' and o.status in ('submitted', 'in_review') then v_new := 'rejected';
  else raise exception 'INVALID_STATE';
  end if;
  if p_decision in ('request_info', 'reject') and v_note is null then raise exception 'REASON_REQUIRED'; end if;

  perform set_config('sdz.fn', '1', true);
  update public.organizations set status = v_new,
    org_number = case when v_new = 'approved' and org_number is null
                      then 'SDZ-O-' || lpad(nextval('public.org_number_seq')::text, 5, '0') else org_number end
   where id = p_org;
  update public.organization_applications
     set status = v_new, decided_at = case when v_new <> 'in_review' then now() end,
         decided_by = auth.uid(), decision_note = v_note
   where id = (select id from public.organization_applications
               where organization_id = p_org order by submitted_at desc limit 1);
  perform public.audit_write('organization.' || p_decision, 'organizations', p_org::text, null,
                             jsonb_build_object('status', v_new, 'note', v_note));
end $$;

-- ============ VEREJNÝ POHĽAD (bez interných údajov) ============
create view public.public_organizations as
  select o.id, o.slug, o.name, o.type, o.description, o.logo_path, o.website, o.org_number,
         o.region_id, r.name as region_name, d.name as district_name
  from public.organizations o
  left join public.regions r on r.id = o.region_id
  left join public.districts d on d.id = o.district_id
  where o.status = 'approved';
grant select on public.public_organizations to anon, authenticated;

-- ============ RLS ============
alter table public.organizations enable row level security;
alter table public.organization_applications enable row level security;
alter table public.organization_documents enable row level security;
revoke all on public.organizations from anon;
revoke all on public.organization_applications from anon;
revoke all on public.organization_documents from anon;

create policy org_select on public.organizations for select to authenticated
  using (public.has_permission(auth.uid(), 'org.view', 'organization', id)
         or public.has_permission(auth.uid(), 'orgs.read'));
create policy org_update on public.organizations for update to authenticated
  using (status in ('draft', 'needs_info', 'approved')
         and public.has_permission(auth.uid(), 'org.manage', 'organization', id))
  with check (status in ('draft', 'needs_info', 'approved')
         and public.has_permission(auth.uid(), 'org.manage', 'organization', id));

create policy org_apps_select on public.organization_applications for select to authenticated
  using (public.has_permission(auth.uid(), 'org.view', 'organization', organization_id)
         or public.has_permission(auth.uid(), 'orgs.read'));

create policy org_docs_select on public.organization_documents for select to authenticated
  using (public.has_permission(auth.uid(), 'org.documents', 'organization', organization_id)
         or public.has_permission(auth.uid(), 'orgs.read'));
create policy org_docs_insert on public.organization_documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.has_permission(auth.uid(), 'org.documents', 'organization', organization_id)
    and storage_path like organization_id::text || '/%'
    and exists (select 1 from public.organizations o where o.id = organization_id
                and o.status in ('draft', 'needs_info', 'approved')));
create policy org_docs_delete on public.organization_documents for delete to authenticated
  using (public.has_permission(auth.uid(), 'org.documents', 'organization', organization_id)
         and exists (select 1 from public.organizations o where o.id = organization_id
                     and o.status in ('draft', 'needs_info')));

-- ============ ÚLOŽISKO: DOKUMENTY ORGANIZÁCIE ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-documents', 'org-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy orgdocs_read on storage.objects for select to authenticated
  using (bucket_id = 'org-documents' and (
    public.has_permission(auth.uid(), 'org.documents', 'organization', ((storage.foldername(name))[1])::uuid)
    or public.has_permission(auth.uid(), 'orgs.read')));
create policy orgdocs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'org-documents'
    and public.has_permission(auth.uid(), 'org.documents', 'organization', ((storage.foldername(name))[1])::uuid));
create policy orgdocs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'org-documents'
    and public.has_permission(auth.uid(), 'org.documents', 'organization', ((storage.foldername(name))[1])::uuid));
