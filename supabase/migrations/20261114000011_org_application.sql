-- Žiadosť organizácie písanou formou: jeden formulár = odoslaná žiadosť na SDZ (bez licencie, bez dokumentov)
alter table public.organization_applications
  add column applicant_message text check (applicant_message is null or char_length(applicant_message) <= 4000);

create function public.apply_organization(
  p_name text, p_type text, p_slug text, p_region uuid, p_address text,
  p_email text, p_phone text, p_description text, p_message text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role uuid; p public.profiles%rowtype; r record;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select * into p from public.profiles where id = auth.uid();
  if p.birth_year is null or extract(year from current_date)::int - p.birth_year < 21 then raise exception 'COORDINATOR_AGE'; end if;
  if not exists (select 1 from public.regions where id = p_region) then raise exception 'ORG_INCOMPLETE'; end if;
  if char_length(trim(coalesce(p_address, ''))) < 3 or char_length(trim(coalesce(p_email, ''))) < 5
     or char_length(trim(coalesce(p_description, ''))) < 20 then raise exception 'ORG_INCOMPLETE'; end if;
  perform set_config('sdz.fn', '1', true);
  insert into public.organizations (name, type, slug, region_id, address, contact_email, contact_phone, description, status, created_by)
  values (trim(p_name), p_type, p_slug, p_region, trim(p_address), trim(p_email), nullif(trim(coalesce(p_phone, '')), ''),
          trim(p_description), 'submitted', auth.uid())
  returning id into v_id;
  select id into v_role from public.roles where key = 'org_owner';
  insert into public.user_roles (user_id, role_id, scope_type, scope_id, granted_by)
  values (auth.uid(), v_role, 'organization', v_id, auth.uid());
  insert into public.organization_applications (organization_id, coordinator_id, applicant_message)
  values (v_id, auth.uid(), nullif(trim(coalesce(p_message, '')), ''));
  perform public.audit_write('organization.submitted', 'organizations', v_id::text);
  for r in
    select distinct ur.user_id from public.user_roles ur join public.role_permissions rp on rp.role_id = ur.role_id
     where ur.revoked_at is null and ur.scope_type = 'system' and rp.permission_key = 'orgs.review'
  loop
    perform public.notify(r.user_id, 'organization.application', 'Nová žiadosť organizácie', trim(p_name), '/admin/organizations');
  end loop;
  return v_id;
exception when unique_violation then
  raise exception 'DUPLICATE';
end $$;

-- zamestnanci organizácie vidia fotografie jej členov (súkromný bucket)
create policy avatars_org_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and exists (
    select 1 from public.volunteers v
     where v.profile_id::text = (storage.foldername(name))[1] and public.staff_sees_volunteer(v.id)));
