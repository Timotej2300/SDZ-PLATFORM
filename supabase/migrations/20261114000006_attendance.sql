-- SDZ FÁZA 5: manuálna dochádzka (bez QR), odpracované hodiny, opravy s dôvodom, certifikáty

insert into public.permissions (key, scope, description) values
  ('attendance.write', 'organization', 'Zápis a oprava dochádzky'),
  ('certificates.issue', 'organization', 'Vystavovanie certifikátov o dobrovoľníckej činnosti');

with m(role_key, perms) as (values
  ('org_owner', array['attendance.write','certificates.issue']),
  ('org_chairman', array['attendance.write','certificates.issue']),
  ('org_administrator', array['attendance.write','certificates.issue']),
  ('org_vice_chairman', array['attendance.write','certificates.issue']),
  ('org_event_manager', array['attendance.write','certificates.issue']),
  ('org_event_coordinator', array['attendance.write']),
  ('org_team_leader', array['attendance.write'])
)
insert into public.role_permissions (role_id, permission_key)
select r.id, p from m join public.roles r on r.key = m.role_key, unnest(m.perms) p;

create sequence public.certificate_seq;

-- ============ DOCHÁDZKA ============
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  shift_id uuid not null references public.event_shifts(id),
  volunteer_id uuid not null references public.volunteers(id),
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, volunteer_id),
  check (checked_out_at is null or checked_out_at > checked_in_at),
  check (checked_out_at is null or checked_out_at - checked_in_at <= interval '24 hours')
);
create index attendance_event_idx on public.attendance_records (event_id);
create index attendance_vol_idx on public.attendance_records (volunteer_id, checked_in_at desc);
create trigger attendance_updated before update on public.attendance_records
  for each row execute function public.set_updated_at();

create function public.guard_attendance() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE'; end if;
  if current_setting('sdz.fn', true) is distinct from '1' then raise exception 'FORBIDDEN'; end if;
  if new.event_id is distinct from old.event_id or new.shift_id is distinct from old.shift_id
     or new.volunteer_id is distinct from old.volunteer_id or new.recorded_by is distinct from old.recorded_by then
    raise exception 'IMMUTABLE';
  end if;
  return new;
end $$;
create trigger attendance_guard before update or delete on public.attendance_records
  for each row execute function public.guard_attendance();

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance_records(id),
  corrected_by uuid not null references public.profiles(id),
  corrected_at timestamptz not null default now(),
  reason text not null check (char_length(btrim(reason)) >= 5),
  old_value jsonb not null,
  new_value jsonb not null
);
create index attendance_corr_idx on public.attendance_corrections (attendance_id);
create trigger attendance_corr_immutable before update or delete on public.attendance_corrections
  for each row execute function public.immutable_row();

create trigger audit_attendance after insert or update on public.attendance_records
  for each row execute function public.audit_row();
create trigger audit_attendance_corr after insert on public.attendance_corrections
  for each row execute function public.audit_row();

-- odpracované hodiny (iba ukončené záznamy)
create view public.volunteer_hours with (security_invoker = true) as
select a.id as attendance_id, a.volunteer_id, a.event_id, a.shift_id, a.checked_in_at, a.checked_out_at,
       round(extract(epoch from (a.checked_out_at - a.checked_in_at)) / 3600.0, 2) as hours
  from public.attendance_records a
 where a.checked_out_at is not null;

-- ============ CERTIFIKÁTY ============
create table public.volunteer_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique check (certificate_number ~ '^SDZ-C-\d{6}$'),
  volunteer_id uuid not null references public.volunteers(id),
  event_id uuid not null references public.events(id),
  title text not null,
  hours numeric(7, 2) not null check (hours > 0),
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revoke_reason text,
  unique (event_id, volunteer_id)
);
create index certificates_vol_idx on public.volunteer_certificates (volunteer_id);

create function public.guard_certificate() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE'; end if;
  if current_setting('sdz.fn', true) is distinct from '1' then raise exception 'FORBIDDEN'; end if;
  if new.certificate_number is distinct from old.certificate_number or new.volunteer_id is distinct from old.volunteer_id
     or new.event_id is distinct from old.event_id or new.hours is distinct from old.hours
     or new.title is distinct from old.title or new.issued_at is distinct from old.issued_at
     or new.issued_by is distinct from old.issued_by or old.revoked_at is not null then
    raise exception 'IMMUTABLE';
  end if;
  return new;
end $$;
create trigger certificates_guard before update or delete on public.volunteer_certificates
  for each row execute function public.guard_certificate();
create trigger audit_certificates after insert or update on public.volunteer_certificates
  for each row execute function public.audit_row();

-- ============ FUNKCIE ============
-- brána pre dochádzku: oprávnenie, stav organizácie (pozastavená iba pre už prebiehajúce podujatie), licencia
create function public._attendance_gate(p_shift uuid, p_volunteer uuid, p_check_license boolean)
returns public.events
language plpgsql security definer set search_path = public as $$
declare s public.event_shifts%rowtype; e public.events%rowtype; o public.organizations%rowtype; v public.volunteers%rowtype;
begin
  select * into s from public.event_shifts where id = p_shift;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into e from public.events where id = s.event_id;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'attendance.write', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if e.status <> 'published' then raise exception 'EVENT_CLOSED'; end if;
  select * into o from public.organizations where id = e.organization_id;
  if o.status = 'suspended' then
    if e.starts_at > now() then raise exception 'ORG_NOT_AVAILABLE'; end if;
  elsif o.status <> 'approved' then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  if p_volunteer is not null then
    select * into v from public.volunteers where id = p_volunteer;
    if not found then raise exception 'NOT_FOUND'; end if;
    if v.status <> 'active' then raise exception 'VOLUNTEER_INACTIVE'; end if;
    if p_check_license and not public.current_license_ok(p_volunteer) then
      -- výnimka: licencia expirovala počas už začatého podujatia (platila na jeho začiatku)
      if e.starts_at <= now() and public.current_license_ok(p_volunteer, e.starts_at::date) then
        perform public.audit_write('license.exception.ongoing_event', 'events', e.id::text, null,
          jsonb_build_object('volunteer_id', p_volunteer, 'shift_id', p_shift), 'warning');
      else
        raise exception 'LICENSE_REQUIRED';
      end if;
    end if;
  end if;
  return e;
end $$;
revoke execute on function public._attendance_gate(uuid, uuid, boolean) from public, anon, authenticated;

create function public._check_times(p_in timestamptz, p_out timestamptz, p_shift public.event_shifts) returns void
language plpgsql stable as $$
begin
  if p_in is null or p_in > now() + interval '5 minutes' then raise exception 'INVALID_TIME'; end if;
  if p_in < p_shift.starts_at - interval '12 hours' or p_in > p_shift.ends_at + interval '12 hours' then
    raise exception 'INVALID_TIME';
  end if;
  if p_out is not null and (p_out <= p_in or p_out > now() + interval '5 minutes'
                            or p_out - p_in > interval '24 hours') then
    raise exception 'INVALID_TIME';
  end if;
end $$;

create function public.record_attendance(p_shift uuid, p_volunteer uuid, p_in timestamptz, p_out timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events; s public.event_shifts%rowtype; v_id uuid;
begin
  e := public._attendance_gate(p_shift, p_volunteer, true);
  select * into s from public.event_shifts where id = p_shift;
  perform public._check_times(p_in, p_out, s);
  if not exists (select 1 from public.shift_assignments where shift_id = p_shift and volunteer_id = p_volunteer) then
    raise exception 'NOT_ASSIGNED';
  end if;
  if exists (select 1 from public.attendance_records where shift_id = p_shift and volunteer_id = p_volunteer) then
    raise exception 'ATTENDANCE_EXISTS';
  end if;
  insert into public.attendance_records (event_id, shift_id, volunteer_id, checked_in_at, checked_out_at, recorded_by)
  values (e.id, p_shift, p_volunteer, p_in, p_out, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create function public.record_checkout(p_id uuid, p_out timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare r public.attendance_records%rowtype; s public.event_shifts%rowtype;
begin
  select * into r from public.attendance_records where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._attendance_gate(r.shift_id, r.volunteer_id, true);
  if r.checked_out_at is not null then raise exception 'INVALID_STATE'; end if;
  select * into s from public.event_shifts where id = r.shift_id;
  perform public._check_times(r.checked_in_at, p_out, s);
  perform set_config('sdz.fn', '1', true);
  update public.attendance_records set checked_out_at = p_out where id = p_id;
end $$;

create function public.correct_attendance(p_id uuid, p_in timestamptz, p_out timestamptz, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.attendance_records%rowtype; s public.event_shifts%rowtype; v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into r from public.attendance_records where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._attendance_gate(r.shift_id, r.volunteer_id, false);
  if char_length(v_reason) < 5 then raise exception 'REASON_REQUIRED'; end if;
  select * into s from public.event_shifts where id = r.shift_id;
  perform public._check_times(p_in, p_out, s);
  if p_in is not distinct from r.checked_in_at and p_out is not distinct from r.checked_out_at then
    raise exception 'INVALID';
  end if;
  insert into public.attendance_corrections (attendance_id, corrected_by, reason, old_value, new_value)
  values (p_id, auth.uid(), v_reason,
          jsonb_build_object('checked_in_at', r.checked_in_at, 'checked_out_at', r.checked_out_at),
          jsonb_build_object('checked_in_at', p_in, 'checked_out_at', p_out));
  perform set_config('sdz.fn', '1', true);
  update public.attendance_records set checked_in_at = p_in, checked_out_at = p_out where id = p_id;
end $$;

create function public.issue_certificate(p_event uuid, p_volunteer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; v_hours numeric; v_id uuid;
begin
  select * into e from public.events where id = p_event;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'certificates.issue', 'organization', e.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if e.status <> 'published' then raise exception 'EVENT_CLOSED'; end if;
  if e.ends_at > now() then raise exception 'EVENT_NOT_ENDED'; end if;
  if exists (select 1 from public.attendance_records where event_id = p_event and volunteer_id = p_volunteer
             and checked_out_at is null) then
    raise exception 'ATTENDANCE_OPEN';
  end if;
  select coalesce(sum(hours), 0) into v_hours from public.volunteer_hours
   where event_id = p_event and volunteer_id = p_volunteer;
  if v_hours <= 0 then raise exception 'NO_HOURS'; end if;
  if exists (select 1 from public.volunteer_certificates where event_id = p_event and volunteer_id = p_volunteer) then
    raise exception 'DUPLICATE';
  end if;
  insert into public.volunteer_certificates (certificate_number, volunteer_id, event_id, title, hours, issued_by)
  values ('SDZ-C-' || lpad(nextval('public.certificate_seq')::text, 6, '0'), p_volunteer, p_event,
          'Potvrdenie o dobrovoľníckej činnosti – ' || e.title, v_hours, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create function public.revoke_certificate(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.volunteer_certificates%rowtype; v_org uuid; v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into c from public.volunteer_certificates where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select organization_id into v_org from public.events where id = c.event_id;
  if auth.uid() is null or not (public.has_permission(auth.uid(), 'certificates.issue', 'organization', v_org)
                                or public.has_permission(auth.uid(), 'volunteers.review')) then
    raise exception 'FORBIDDEN';
  end if;
  if c.revoked_at is not null then raise exception 'INVALID_STATE'; end if;
  if char_length(v_reason) < 3 then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('sdz.fn', '1', true);
  update public.volunteer_certificates set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = v_reason
   where id = p_id;
end $$;

-- ============ RLS ============
alter table public.attendance_records enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.volunteer_certificates enable row level security;
revoke all on public.attendance_records, public.attendance_corrections, public.volunteer_certificates from anon;
revoke insert, update, delete on public.attendance_records, public.attendance_corrections,
  public.volunteer_certificates from authenticated, anon;
grant select on public.volunteer_hours to authenticated;
revoke all on public.volunteer_hours from anon;

create policy attendance_select on public.attendance_records for select to authenticated
  using (volunteer_id = public.my_volunteer()
         or public.event_staff(event_id)
         or public.has_permission(auth.uid(), 'events.read'));
create policy attendance_corr_select on public.attendance_corrections for select to authenticated
  using (attendance_id in (select id from public.attendance_records));
create policy certificates_select on public.volunteer_certificates for select to authenticated
  using (volunteer_id = public.my_volunteer()
         or public.has_permission(auth.uid(), 'certificates.issue', 'organization', public.event_org(event_id))
         or public.has_permission(auth.uid(), 'events.read')
         or public.has_permission(auth.uid(), 'volunteers.review'));
