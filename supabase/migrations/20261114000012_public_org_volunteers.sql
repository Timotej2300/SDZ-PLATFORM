-- Verejný zoznam dobrovoľníkov organizácie: iba tí, ktorí si zapli „Zobraziť domovskú organizáciu“.
-- Bez roku narodenia, e-mailu a telefónu; fotografia iba ak ju dobrovoľník povolil.
create function public.public_org_volunteers(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.organizations%rowtype; v_total bigint; v_items jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{1,80}$' then return null; end if;
  select * into o from public.organizations where slug = p_slug and status in ('approved', 'suspended');
  if not found then return null; end if;
  select count(*) into v_total from public.organization_memberships m
    join public.volunteers v on v.id = m.volunteer_id
   where m.organization_id = o.id and m.status = 'active' and v.status = 'active';
  select coalesce(jsonb_agg(jsonb_build_object(
      'registration_number', x.registration_number, 'first_name', x.first_name, 'last_name', x.last_name,
      'avatar_path', x.avatar_path, 'license_status', x.lstatus, 'license_expires', x.lexp)
      order by x.last_name, x.first_name), '[]'::jsonb) into v_items
  from (
    select v.registration_number, p.first_name, p.last_name,
           case when v.public_show_photo then p.avatar_path end as avatar_path,
           case when l.id is null then null
                when l.status in ('active', 'expiring') and l.expires_on < current_date then 'expired'
                else l.status::text end as lstatus,
           l.expires_on as lexp
      from public.organization_memberships m
      join public.volunteers v on v.id = m.volunteer_id
      join public.profiles p on p.id = v.profile_id
      left join lateral (select y.id, y.status, y.expires_on from public.volunteer_licenses y
                          where y.volunteer_id = v.id order by y.created_at desc limit 1) l on true
     where m.organization_id = o.id and m.status = 'active' and v.status = 'active' and v.public_show_organization
     limit 500) x;
  return jsonb_build_object('total', v_total, 'items', v_items);
end $$;
grant execute on function public.public_org_volunteers(text) to anon, authenticated;
