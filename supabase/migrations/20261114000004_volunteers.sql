-- SDZ FÁZA 3: dobrovoľníci, registračné čísla, licencie, členstvá, pozvánky, registrácie, prestupy, hosťovania

create type public.license_status as enum ('active', 'expiring', 'expired', 'suspended', 'cancelled');
create type public.membership_status as enum ('active', 'ended');
create type public.transfer_status as enum
  ('pending_origin', 'pending_target', 'approved', 'rejected_origin', 'rejected_target', 'cancelled', 'overdue_review');
create type public.guesting_status as enum
  ('pending_home', 'pending_host', 'active', 'ended', 'rejected', 'cancelled');

create sequence public.license_seq;

-- ============ DOBROVOĽNÍCI ============
create table public.volunteers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id),
  registration_number text not null unique check (registration_number ~ '^SDZ-\d{4}-\d{4}-\d{4}$'),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  home_organization_id uuid references public.organizations(id),
  public_show_photo boolean not null default false,
  public_show_organization boolean not null default false,
  public_show_transfer_history boolean not null default false,
  public_show_history boolean not null default false,
  created_at timestamptz not null default now()
);

-- registračné čísla sa nikdy znovu nepridelia
create table public.registration_number_registry (
  registration_number text primary key,
  issued_at timestamptz not null default now()
);

create function public.immutable_row() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE';
end $$;
create trigger registry_immutable before update or delete on public.registration_number_registry
  for each row execute function public.immutable_row();

create function public.guard_volunteer() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE'; end if;
  if new.registration_number is distinct from old.registration_number then raise exception 'IMMUTABLE'; end if;
  if current_setting('sdz.fn', true) is distinct from '1' then
    if new.id is distinct from old.id or new.profile_id is distinct from old.profile_id
       or new.status is distinct from old.status
       or new.home_organization_id is distinct from old.home_organization_id then
      raise exception 'FORBIDDEN';
    end if;
  end if;
  return new;
end $$;
create trigger volunteers_guard before update or delete on public.volunteers
  for each row execute function public.guard_volunteer();
create trigger audit_volunteers after insert or update on public.volunteers
  for each row execute function public.audit_row();

create function public.generate_registration_number() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_n bigint; v_s text; v_reg text; v_try int := 0; v_ok int;
begin
  loop
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'REGNUM_FAILED'; end if;
    v_n := ('x' || encode(gen_random_bytes(6), 'hex'))::bit(48)::bigint % 1000000000000;
    v_s := lpad(v_n::text, 12, '0');
    v_reg := 'SDZ-' || substr(v_s, 1, 4) || '-' || substr(v_s, 5, 4) || '-' || substr(v_s, 9, 4);
    insert into public.registration_number_registry (registration_number) values (v_reg)
      on conflict do nothing;
    get diagnostics v_ok = row_count;
    exit when v_ok = 1;
  end loop;
  return v_reg;
end $$;
revoke execute on function public.generate_registration_number() from public, anon, authenticated;

-- ============ ČLENSTVÁ (max. 1 aktívne) ============
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id),
  organization_id uuid not null references public.organizations(id),
  status public.membership_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check ((status = 'active' and ended_at is null) or (status = 'ended' and ended_at is not null))
);
create unique index one_active_home_membership on public.organization_memberships (volunteer_id) where status = 'active';
create index memberships_org_idx on public.organization_memberships (organization_id) where status = 'active';

create function public.sync_home_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sdz.fn', '1', true);
  if new.status = 'active' then
    update public.volunteers set home_organization_id = new.organization_id where id = new.volunteer_id;
  elsif old.status = 'active' and new.status = 'ended' then
    update public.volunteers set home_organization_id = null
     where id = new.volunteer_id and home_organization_id = new.organization_id;
  end if;
  return new;
end $$;
create trigger memberships_sync after insert or update on public.organization_memberships
  for each row execute function public.sync_home_org();
create trigger audit_memberships after insert or update on public.organization_memberships
  for each row execute function public.audit_row();

-- ============ LICENCIE ============
create table public.volunteer_licenses (
  id uuid primary key default gen_random_uuid(),
  license_number text not null unique,
  volunteer_id uuid not null references public.volunteers(id),
  issued_on date not null default current_date,
  expires_on date not null,
  status public.license_status not null default 'active',
  created_at timestamptz not null default now(),
  check (expires_on > issued_on and expires_on <= issued_on + interval '5 years')
);
create unique index one_current_license on public.volunteer_licenses (volunteer_id) where status in ('active', 'expiring');
create index licenses_vol_idx on public.volunteer_licenses (volunteer_id, created_at desc);
create index licenses_expiry_idx on public.volunteer_licenses (expires_on) where status in ('active', 'expiring');

create table public.license_history (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.volunteer_licenses(id),
  event text not null,
  old_status public.license_status,
  new_status public.license_status,
  actor uuid,
  note text,
  created_at timestamptz not null default now()
);
create table public.license_renewals (
  id uuid primary key default gen_random_uuid(),
  previous_license_id uuid not null references public.volunteer_licenses(id),
  new_license_id uuid not null references public.volunteer_licenses(id),
  requested_by uuid not null references public.profiles(id),
  previous_expiry date not null,
  new_expiry date not null,
  created_at timestamptz not null default now()
);

create function public.guard_license() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE'; end if;
  if current_setting('sdz.fn', true) is distinct from '1' then raise exception 'FORBIDDEN'; end if;
  if new.license_number is distinct from old.license_number or new.volunteer_id is distinct from old.volunteer_id
     or new.issued_on is distinct from old.issued_on or new.expires_on is distinct from old.expires_on then
    raise exception 'IMMUTABLE';
  end if;
  return new;
end $$;
create trigger licenses_guard before update or delete on public.volunteer_licenses
  for each row execute function public.guard_license();
create trigger audit_licenses after insert or update on public.volunteer_licenses
  for each row execute function public.audit_row();

-- vydanie licencie (interná funkcia)
create function public._issue_license(p_volunteer uuid, p_actor uuid, p_event text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform set_config('sdz.fn', '1', true);
  insert into public.volunteer_licenses (license_number, volunteer_id, issued_on, expires_on)
  values ('SDZ-L-' || lpad(nextval('public.license_seq')::text, 6, '0'), p_volunteer,
          current_date, (current_date + interval '5 years')::date - 1)
  returning id into v_id;
  insert into public.license_history (license_id, event, new_status, actor)
  values (v_id, p_event, 'active', p_actor);
  return v_id;
end $$;
revoke execute on function public._issue_license(uuid, uuid, text) from public, anon, authenticated;

-- ============ POZVÁNKY A REGISTRÁCIE ============
create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  used_by uuid references public.profiles(id)
);
create index invitations_org_idx on public.organization_invitations (organization_id, created_at desc);
create unique index invitations_open_unique on public.organization_invitations (organization_id, lower(email)) where used_at is null;

create table public.volunteer_registrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  organization_id uuid not null references public.organizations(id),
  invitation_id uuid references public.organization_invitations(id),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'needs_info', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  note text,
  volunteer_id uuid references public.volunteers(id)
);
create unique index registrations_open_unique on public.volunteer_registrations (profile_id)
  where status in ('submitted', 'in_review', 'needs_info');
create index registrations_org_idx on public.volunteer_registrations (organization_id, submitted_at desc);
create trigger audit_registrations after insert or update on public.volunteer_registrations
  for each row execute function public.audit_row();

create function public.create_invitation(p_org uuid, p_email text, p_token_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'volunteers.invite', 'organization', p_org) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.organizations where id = p_org and status = 'approved') then
    raise exception 'ORG_NOT_AVAILABLE';
  end if;
  -- vypršané nepoužité pozvánky uvoľnia miesto pre novú
  delete from public.organization_invitations
   where organization_id = p_org and lower(email) = lower(trim(p_email)) and used_at is null and expires_at < now();
  insert into public.organization_invitations (organization_id, email, token_hash, created_by)
  values (p_org, lower(trim(p_email)), p_token_hash, auth.uid()) returning id into v_id;
  perform public.audit_write('invitation.created', 'organization_invitations', v_id::text, null,
                             jsonb_build_object('org', p_org, 'email', lower(trim(p_email))));
  return v_id;
exception when unique_violation then
  raise exception 'DUPLICATE';
end $$;

-- overenie pozvánky pre registračný formulár (volá aj anonym)
create function public.lookup_invitation(p_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  select i.email, o.name as org_name into r
    from public.organization_invitations i join public.organizations o on o.id = i.organization_id
   where i.token_hash = p_hash and i.used_at is null and i.expires_at > now() and o.status = 'approved';
  if not found then return null; end if;
  return jsonb_build_object('email', r.email, 'organization', r.org_name);
end $$;
grant execute on function public.lookup_invitation(text) to anon, authenticated;

create function public._register_from_invitation(p_profile uuid, p_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.organization_invitations%rowtype; pr public.profiles%rowtype; v_rid uuid;
begin
  select * into pr from public.profiles where id = p_profile;
  select * into i from public.organization_invitations
   where token_hash = p_hash and used_at is null and expires_at > now() for update;
  if not found then return null; end if;
  if lower(i.email) <> lower(pr.email) then return null; end if;
  if exists (select 1 from public.volunteers where profile_id = p_profile) then return null; end if;
  if not exists (select 1 from public.organizations where id = i.organization_id and status = 'approved') then return null; end if;
  insert into public.volunteer_registrations (profile_id, organization_id, invitation_id)
  values (p_profile, i.organization_id, i.id) returning id into v_rid;
  update public.organization_invitations set used_at = now(), used_by = p_profile where id = i.id;
  return v_rid;
exception when unique_violation then
  return null;
end $$;
revoke execute on function public._register_from_invitation(uuid, text) from public, anon, authenticated;

-- nový účet s pozvánkou v metadátach => žiadosť o registráciu
create function public.claim_invitation_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  select raw_user_meta_data->>'invitation_hash' into v_hash from auth.users where id = new.id;
  if v_hash is not null then
    perform public._register_from_invitation(new.id, v_hash);
  end if;
  return new;
end $$;
create trigger profiles_claim_invitation after insert on public.profiles
  for each row execute function public.claim_invitation_on_signup();

-- existujúci účet uplatní pozvánku
create function public.claim_invitation(p_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_rid uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  v_rid := public._register_from_invitation(auth.uid(), p_hash);
  if v_rid is null then raise exception 'INVITATION_INVALID'; end if;
  return v_rid;
end $$;

-- po doplnení údajov dobrovoľník vráti žiadosť na kontrolu
create function public.resubmit_registration(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.volunteer_registrations set status = 'submitted', note = null
   where id = p_id and profile_id = auth.uid() and status = 'needs_info';
  if not found then raise exception 'INVALID_STATE'; end if;
end $$;

-- rozhodnutie SDZ o registrácii dobrovoľníka
create function public.review_volunteer_registration(p_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.volunteer_registrations%rowtype;
  pr public.profiles%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_new text; v_vol uuid; v_org_name text;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'volunteers.review') then
    raise exception 'FORBIDDEN';
  end if;
  select * into r from public.volunteer_registrations where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_decision = 'start_review' and r.status = 'submitted' then v_new := 'in_review';
  elsif p_decision = 'request_info' and r.status in ('submitted', 'in_review') then v_new := 'needs_info';
  elsif p_decision = 'approve' and r.status in ('submitted', 'in_review') then v_new := 'approved';
  elsif p_decision = 'reject' and r.status in ('submitted', 'in_review') then v_new := 'rejected';
  else raise exception 'INVALID_STATE';
  end if;
  if p_decision in ('request_info', 'reject') and v_note is null then raise exception 'REASON_REQUIRED'; end if;

  if v_new = 'approved' then
    select * into pr from public.profiles where id = r.profile_id;
    if not exists (select 1 from auth.users where id = r.profile_id and email_confirmed_at is not null) then
      raise exception 'EMAIL_NOT_VERIFIED';
    end if;
    -- kým nie je schválené pravidlo pre maloletých, registrujeme iba plnoletých
    -- (iba rok narodenia: rozdiel >= 19 zaručuje vek aspoň 18 rokov)
    if pr.birth_year is null or extract(year from current_date)::int - pr.birth_year < 19 then
      raise exception 'MINOR_NOT_SUPPORTED';
    end if;
    if not exists (select 1 from public.organizations where id = r.organization_id and status = 'approved') then
      raise exception 'ORG_NOT_AVAILABLE';
    end if;
    perform set_config('sdz.fn', '1', true);
    insert into public.volunteers (profile_id, registration_number)
    values (r.profile_id, public.generate_registration_number()) returning id into v_vol;
    insert into public.organization_memberships (volunteer_id, organization_id) values (v_vol, r.organization_id);
    perform public._issue_license(v_vol, auth.uid(), 'issued');
  end if;

  perform set_config('sdz.fn', '1', true);
  update public.volunteer_registrations
     set status = v_new, note = v_note, volunteer_id = coalesce(v_vol, volunteer_id),
         decided_at = case when v_new <> 'in_review' then now() end, decided_by = auth.uid()
   where id = p_id;
  perform public.audit_write('registration.' || p_decision, 'volunteer_registrations', p_id::text);
end $$;

-- ============ PRESTUPY ============
create table public.volunteer_transfers (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id),
  from_org_id uuid not null references public.organizations(id),
  to_org_id uuid not null references public.organizations(id),
  from_org_name text not null,
  to_org_name text not null,
  status public.transfer_status not null default 'pending_origin',
  requested_at timestamptz not null default now(),
  origin_due_at timestamptz not null default now() + interval '30 days',
  origin_decided_at timestamptz,
  origin_decided_by uuid references public.profiles(id),
  target_due_at timestamptz,
  target_decided_at timestamptz,
  target_decided_by uuid references public.profiles(id),
  overdue_from text check (overdue_from in ('origin', 'target')),
  overdue_at timestamptz,
  rejection_reason text,
  sdz_review_requested_at timestamptz,
  sdz_note text,
  check (from_org_id <> to_org_id)
);
create unique index one_open_transfer on public.volunteer_transfers (volunteer_id)
  where status in ('pending_origin', 'pending_target', 'overdue_review');
create index transfers_from_idx on public.volunteer_transfers (from_org_id);
create index transfers_to_idx on public.volunteer_transfers (to_org_id);

create table public.transfer_history (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.volunteer_transfers(id),
  event text not null,
  actor uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create function public.guard_transfer() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' or current_setting('sdz.fn', true) is distinct from '1' then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;
create trigger transfers_guard before update or delete on public.volunteer_transfers
  for each row execute function public.guard_transfer();
create trigger audit_transfers after insert or update on public.volunteer_transfers
  for each row execute function public.audit_row();

create function public.request_transfer(p_to uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.volunteers%rowtype; m public.organization_memberships%rowtype; v_from text; v_to text; v_id uuid;
begin
  select * into v from public.volunteers where profile_id = auth.uid();
  if not found then raise exception 'NOT_VOLUNTEER'; end if;
  select * into m from public.organization_memberships where volunteer_id = v.id and status = 'active';
  if not found then raise exception 'NO_MEMBERSHIP'; end if;
  if m.organization_id = p_to then raise exception 'SAME_ORG'; end if;
  select name into v_to from public.organizations where id = p_to and status = 'approved';
  if v_to is null then raise exception 'ORG_NOT_AVAILABLE'; end if;
  select name into v_from from public.organizations where id = m.organization_id;
  perform set_config('sdz.fn', '1', true);
  insert into public.volunteer_transfers (volunteer_id, from_org_id, to_org_id, from_org_name, to_org_name)
  values (v.id, m.organization_id, p_to, v_from, v_to) returning id into v_id;
  insert into public.transfer_history (transfer_id, event, actor) values (v_id, 'requested', auth.uid());
  return v_id;
exception when unique_violation then
  raise exception 'TRANSFER_OPEN';
end $$;

create function public.decide_transfer(p_id uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.volunteer_transfers%rowtype;
  v_stage text; v_org uuid; v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into t from public.volunteer_transfers where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_stage := case t.status when 'pending_origin' then 'origin' when 'pending_target' then 'target'
                           when 'overdue_review' then t.overdue_from else null end;
  if v_stage is null then raise exception 'INVALID_STATE'; end if;
  v_org := case v_stage when 'origin' then t.from_org_id else t.to_org_id end;
  if auth.uid() is null or not public.has_permission(auth.uid(), 'transfers.decide', 'organization', v_org) then
    raise exception 'FORBIDDEN';
  end if;
  if p_decision not in ('approve', 'reject') then raise exception 'INVALID'; end if;
  if p_decision = 'reject' and v_reason is null then raise exception 'REASON_REQUIRED'; end if;
  if not exists (select 1 from public.organization_memberships
                 where volunteer_id = t.volunteer_id and organization_id = t.from_org_id and status = 'active') then
    raise exception 'INVALID_STATE';
  end if;

  perform set_config('sdz.fn', '1', true);
  if v_stage = 'origin' then
    if p_decision = 'approve' then
      update public.volunteer_transfers set status = 'pending_target', origin_decided_at = now(),
        origin_decided_by = auth.uid(), target_due_at = now() + interval '30 days',
        overdue_from = null, overdue_at = null where id = p_id;
    else
      update public.volunteer_transfers set status = 'rejected_origin', origin_decided_at = now(),
        origin_decided_by = auth.uid(), rejection_reason = v_reason where id = p_id;
    end if;
  else
    if p_decision = 'approve' then
      if not exists (select 1 from public.organizations where id = t.to_org_id and status = 'approved') then
        raise exception 'ORG_NOT_AVAILABLE';
      end if;
      update public.organization_memberships set status = 'ended', ended_at = now()
       where volunteer_id = t.volunteer_id and status = 'active';
      insert into public.organization_memberships (volunteer_id, organization_id) values (t.volunteer_id, t.to_org_id);
      update public.volunteer_transfers set status = 'approved', target_decided_at = now(),
        target_decided_by = auth.uid(), overdue_from = null where id = p_id;
    else
      update public.volunteer_transfers set status = 'rejected_target', target_decided_at = now(),
        target_decided_by = auth.uid(), rejection_reason = v_reason, overdue_from = null where id = p_id;
    end if;
  end if;
  insert into public.transfer_history (transfer_id, event, actor, payload)
  values (p_id, v_stage || '_' || p_decision, auth.uid(), jsonb_build_object('reason', v_reason));
end $$;

create function public.cancel_transfer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sdz.fn', '1', true);
  update public.volunteer_transfers set status = 'cancelled'
   where id = p_id and status in ('pending_origin', 'pending_target', 'overdue_review')
     and volunteer_id in (select id from public.volunteers where profile_id = auth.uid());
  if not found then raise exception 'INVALID_STATE'; end if;
  insert into public.transfer_history (transfer_id, event, actor) values (p_id, 'cancelled', auth.uid());
end $$;

-- SDZ vyžiada stanovisko organizácie, ktorá nereagovala v lehote
create function public.sdz_request_statement(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'transfers.review') then
    raise exception 'FORBIDDEN';
  end if;
  perform set_config('sdz.fn', '1', true);
  update public.volunteer_transfers
     set sdz_review_requested_at = now(), sdz_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_id and status = 'overdue_review';
  if not found then raise exception 'INVALID_STATE'; end if;
  insert into public.transfer_history (transfer_id, event, actor, payload)
  values (p_id, 'sdz_statement_requested', auth.uid(), jsonb_build_object('note', p_note));
  perform public.audit_write('transfer.sdz_statement_requested', 'volunteer_transfers', p_id::text);
end $$;

-- ============ HOSŤOVANIA ============
create table public.volunteer_guestings (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id),
  home_org_id uuid not null references public.organizations(id),
  host_org_id uuid not null references public.organizations(id),
  home_org_name text not null,
  host_org_name text not null,
  starts_on date not null,
  ends_on date not null,
  status public.guesting_status not null default 'pending_home',
  rejection_reason text,
  created_at timestamptz not null default now(),
  decided_home_by uuid references public.profiles(id),
  decided_host_by uuid references public.profiles(id),
  check (ends_on >= starts_on),
  check (home_org_id <> host_org_id)
);
create index guestings_vol_idx on public.volunteer_guestings (volunteer_id);
create index guestings_host_idx on public.volunteer_guestings (host_org_id);
create index guestings_home_idx on public.volunteer_guestings (home_org_id);

create function public.guard_guesting() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' or current_setting('sdz.fn', true) is distinct from '1' then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;
create trigger guestings_guard before update or delete on public.volunteer_guestings
  for each row execute function public.guard_guesting();
create trigger audit_guestings after insert or update on public.volunteer_guestings
  for each row execute function public.audit_row();

create function public.current_license_ok(p_volunteer uuid, p_at date default current_date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.volunteer_licenses l
    where l.volunteer_id = p_volunteer and l.status in ('active', 'expiring')
      and l.issued_on <= p_at and l.expires_on >= p_at)
$$;

create function public.request_guesting(p_host uuid, p_start date, p_end date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.volunteers%rowtype; v_home uuid; v_home_name text; v_host_name text; v_id uuid;
begin
  select * into v from public.volunteers where profile_id = auth.uid();
  if not found then raise exception 'NOT_VOLUNTEER'; end if;
  v_home := v.home_organization_id;
  if v_home is null then raise exception 'NO_MEMBERSHIP'; end if;
  if v_home = p_host then raise exception 'SAME_ORG'; end if;
  if p_start < current_date or p_end < p_start then raise exception 'INVALID'; end if;
  if not public.current_license_ok(v.id) then raise exception 'LICENSE_REQUIRED'; end if;
  select name into v_host_name from public.organizations where id = p_host and status = 'approved';
  if v_host_name is null then raise exception 'ORG_NOT_AVAILABLE'; end if;
  select name into v_home_name from public.organizations where id = v_home;
  perform set_config('sdz.fn', '1', true);
  insert into public.volunteer_guestings (volunteer_id, home_org_id, host_org_id, home_org_name, host_org_name, starts_on, ends_on)
  values (v.id, v_home, p_host, v_home_name, v_host_name, p_start, p_end) returning id into v_id;
  return v_id;
end $$;

create function public.decide_guesting(p_id uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare g public.volunteer_guestings%rowtype; v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into g from public.volunteer_guestings where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'INVALID'; end if;
  if p_decision = 'reject' and v_reason is null then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('sdz.fn', '1', true);
  if g.status = 'pending_home' then
    if auth.uid() is null or not public.has_permission(auth.uid(), 'guesting.decide', 'organization', g.home_org_id) then
      raise exception 'FORBIDDEN';
    end if;
    update public.volunteer_guestings
       set status = case when p_decision = 'approve' then 'pending_host'::public.guesting_status else 'rejected' end,
           decided_home_by = auth.uid(), rejection_reason = v_reason where id = p_id;
  elsif g.status = 'pending_host' then
    if auth.uid() is null or not public.has_permission(auth.uid(), 'guesting.decide', 'organization', g.host_org_id) then
      raise exception 'FORBIDDEN';
    end if;
    if p_decision = 'approve' and not exists (select 1 from public.organizations where id = g.host_org_id and status = 'approved') then
      raise exception 'ORG_NOT_AVAILABLE';
    end if;
    update public.volunteer_guestings
       set status = case when p_decision = 'approve' then 'active'::public.guesting_status else 'rejected' end,
           decided_host_by = auth.uid(), rejection_reason = v_reason where id = p_id;
  else
    raise exception 'INVALID_STATE';
  end if;
end $$;

create function public.cancel_guesting(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sdz.fn', '1', true);
  update public.volunteer_guestings set status = 'cancelled'
   where id = p_id and status in ('pending_home', 'pending_host', 'active')
     and volunteer_id in (select id from public.volunteers where profile_id = auth.uid());
  if not found then raise exception 'INVALID_STATE'; end if;
end $$;

-- ============ SPRÁVA LICENCIÍ ============
create function public.renew_license() returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.volunteers%rowtype; cur public.volunteer_licenses%rowtype; v_new uuid;
begin
  select * into v from public.volunteers where profile_id = auth.uid();
  if not found then raise exception 'NOT_VOLUNTEER'; end if;
  if v.status <> 'active' then raise exception 'LICENSE_BLOCKED'; end if;
  select * into cur from public.volunteer_licenses where volunteer_id = v.id order by created_at desc limit 1;
  if cur.status in ('suspended', 'cancelled') then raise exception 'LICENSE_BLOCKED'; end if;
  if cur.expires_on > current_date + 90 then raise exception 'RENEW_TOO_EARLY'; end if;

  perform set_config('sdz.fn', '1', true);
  if cur.status in ('active', 'expiring') then
    update public.volunteer_licenses set status = 'expired' where id = cur.id;
    insert into public.license_history (license_id, event, old_status, new_status, actor, note)
    values (cur.id, 'replaced_by_renewal', cur.status, 'expired', auth.uid(), null);
  end if;
  v_new := public._issue_license(v.id, auth.uid(), 'renewed');
  insert into public.license_renewals (previous_license_id, new_license_id, requested_by, previous_expiry, new_expiry)
  select cur.id, v_new, auth.uid(), cur.expires_on, expires_on from public.volunteer_licenses where id = v_new;
  return v_new;
end $$;

create function public.set_license_status(p_license uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l public.volunteer_licenses%rowtype; v_new public.license_status; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'licenses.manage') then
    raise exception 'FORBIDDEN';
  end if;
  select * into l from public.volunteer_licenses where id = p_license for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_note is null then raise exception 'REASON_REQUIRED'; end if;
  if p_action = 'suspend' and l.status in ('active', 'expiring') then v_new := 'suspended';
  elsif p_action = 'cancel' and l.status in ('active', 'expiring', 'suspended') then v_new := 'cancelled';
  elsif p_action = 'reinstate' and l.status = 'suspended' then
    v_new := case when l.expires_on < current_date then 'expired'
                  when l.expires_on <= current_date + 90 then 'expiring' else 'active' end;
  else raise exception 'INVALID_STATE';
  end if;
  perform set_config('sdz.fn', '1', true);
  update public.volunteer_licenses set status = v_new where id = p_license;
  insert into public.license_history (license_id, event, old_status, new_status, actor, note)
  values (p_license, p_action, l.status, v_new, auth.uid(), v_note);
  perform public.audit_write('license.' || p_action, 'volunteer_licenses', p_license::text, null,
                             jsonb_build_object('note', v_note), 'warning');
end $$;

-- ============ DENNÁ ÚDRŽBA (volá iba cron cez service role) ============
create function public.run_daily_maintenance() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_exp int; n_expd int; n_od int; n_end int;
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

  -- prestupy po lehote: NIKDY sa neschvaľujú automaticky
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

  return jsonb_build_object('licenses_expiring', n_exp, 'licenses_expired', n_expd,
                            'transfers_overdue', n_od, 'guestings_ended', n_end);
end $$;
revoke execute on function public.run_daily_maintenance() from public, anon, authenticated;

-- ============ POMOCNÉ FUNKCIE PRE RLS ============
create function public.staff_sees_volunteer(p_vol uuid) returns boolean
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
$$;

create function public.staff_sees_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.volunteers v
      where v.profile_id = p_profile and public.staff_sees_volunteer(v.id))
    or exists (
      select 1 from public.volunteer_registrations r
      where r.profile_id = p_profile
        and public.has_permission(auth.uid(), 'volunteers.invite', 'organization', r.organization_id))
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_profile and ur.scope_type = 'organization' and ur.revoked_at is null
        and public.has_permission(auth.uid(), 'org.staff.manage', 'organization', ur.scope_id))
$$;

create function public.can_see_transfer(p_from uuid, p_to uuid, p_vol uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.volunteers v where v.id = p_vol and v.profile_id = auth.uid())
      or public.has_permission(auth.uid(), 'transfers.decide', 'organization', p_from)
      or public.has_permission(auth.uid(), 'transfers.decide', 'organization', p_to)
      or public.has_permission(auth.uid(), 'transfers.review')
$$;

-- ============ VEREJNÁ KARTA ============
create function public.get_public_card(p_reg text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.volunteers%rowtype; p public.profiles%rowtype; l public.volunteer_licenses%rowtype;
        v_status text; v_org jsonb := null; v_hist jsonb := null;
begin
  if p_reg is null or p_reg !~ '^SDZ-\d{4}-\d{4}-\d{4}$' then return null; end if;
  select * into v from public.volunteers where registration_number = p_reg and status <> 'archived';
  if not found then return null; end if;
  select * into p from public.profiles where id = v.profile_id;
  select * into l from public.volunteer_licenses where volunteer_id = v.id order by created_at desc limit 1;
  v_status := case when l.id is null then null
                   when l.status in ('active', 'expiring') and l.expires_on < current_date then 'expired'
                   else l.status::text end;
  if v.public_show_organization and v.home_organization_id is not null then
    select jsonb_build_object('name', o.name, 'slug', o.slug) into v_org
      from public.organizations o where o.id = v.home_organization_id and o.status = 'approved';
  end if;
  if v.public_show_transfer_history then
    select coalesce(jsonb_agg(jsonb_build_object('from', t.from_org_name, 'to', t.to_org_name,
             'date', coalesce(t.target_decided_at, t.requested_at)::date) order by t.requested_at desc), '[]'::jsonb)
      into v_hist from public.volunteer_transfers t where t.volunteer_id = v.id and t.status = 'approved';
  end if;
  return jsonb_build_object(
    'registration_number', v.registration_number, 'first_name', p.first_name, 'last_name', p.last_name,
    'avatar_path', case when v.public_show_photo then p.avatar_path end, 'license_status', v_status, 'volunteer_status', v.status,
    'organization', v_org, 'transfer_history', v_hist);
end $$;
grant execute on function public.get_public_card(text) to anon, authenticated;

-- ============ ŠTATISTIKY PRE ADMIN ============
create function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (public.has_permission(auth.uid(), 'orgs.read')
                                or public.has_permission(auth.uid(), 'volunteers.read.all')) then
    raise exception 'FORBIDDEN';
  end if;
  return jsonb_build_object(
    'volunteers', (select count(*) from public.volunteers where status <> 'archived'),
    'organizations', (select count(*) from public.organizations where status = 'approved'),
    'org_applications_open', (select count(*) from public.organizations where status in ('submitted', 'in_review', 'needs_info')),
    'registrations_open', (select count(*) from public.volunteer_registrations where status in ('submitted', 'in_review')),
    'licenses_active', (select count(*) from public.volunteer_licenses where status in ('active', 'expiring') and expires_on >= current_date),
    'licenses_expired', (select count(*) from public.volunteer_licenses l where l.status = 'expired'
                          and not exists (select 1 from public.volunteer_licenses n where n.volunteer_id = l.volunteer_id and n.created_at > l.created_at)),
    'transfers_open', (select count(*) from public.volunteer_transfers where status in ('pending_origin', 'pending_target', 'overdue_review')),
    'transfers_overdue', (select count(*) from public.volunteer_transfers where status = 'overdue_review')
  );
end $$;

-- ============ RLS ============
alter table public.volunteers enable row level security;
alter table public.registration_number_registry enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.volunteer_licenses enable row level security;
alter table public.license_history enable row level security;
alter table public.license_renewals enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.volunteer_registrations enable row level security;
alter table public.volunteer_transfers enable row level security;
alter table public.transfer_history enable row level security;
alter table public.volunteer_guestings enable row level security;
revoke all on public.volunteers, public.organization_memberships, public.volunteer_licenses,
  public.license_history, public.license_renewals, public.organization_invitations,
  public.volunteer_registrations, public.volunteer_transfers, public.transfer_history,
  public.volunteer_guestings, public.registration_number_registry from anon;

-- profil: rozšírenie čítania o štáb organizácie a overovateľov
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid()
         or public.has_permission(auth.uid(), 'users.read')
         or public.has_permission(auth.uid(), 'volunteers.review')
         or public.has_permission(auth.uid(), 'volunteers.read.all')
         or public.has_permission(auth.uid(), 'orgs.review')
         or public.staff_sees_profile(id));

create policy volunteers_select on public.volunteers for select to authenticated
  using (profile_id = auth.uid()
         or public.has_permission(auth.uid(), 'volunteers.read.all')
         or public.staff_sees_volunteer(id));
create policy volunteers_update_own on public.volunteers for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy memberships_select on public.organization_memberships for select to authenticated
  using (volunteer_id in (select id from public.volunteers where profile_id = auth.uid())
         or public.has_permission(auth.uid(), 'volunteers.read', 'organization', organization_id)
         or public.has_permission(auth.uid(), 'volunteers.read.all'));

create policy licenses_select on public.volunteer_licenses for select to authenticated
  using (volunteer_id in (select id from public.volunteers where profile_id = auth.uid())
         or public.has_permission(auth.uid(), 'volunteers.read.all')
         or public.has_permission(auth.uid(), 'licenses.manage')
         or public.staff_sees_volunteer(volunteer_id));
create policy license_history_select on public.license_history for select to authenticated
  using (license_id in (select id from public.volunteer_licenses));
create policy license_renewals_select on public.license_renewals for select to authenticated
  using (new_license_id in (select id from public.volunteer_licenses));

create policy invitations_select on public.organization_invitations for select to authenticated
  using (public.has_permission(auth.uid(), 'volunteers.invite', 'organization', organization_id));

create policy registrations_select on public.volunteer_registrations for select to authenticated
  using (profile_id = auth.uid()
         or public.has_permission(auth.uid(), 'volunteers.invite', 'organization', organization_id)
         or public.has_permission(auth.uid(), 'volunteers.review'));

create policy transfers_select on public.volunteer_transfers for select to authenticated
  using (public.can_see_transfer(from_org_id, to_org_id, volunteer_id));
create policy transfer_history_select on public.transfer_history for select to authenticated
  using (transfer_id in (select id from public.volunteer_transfers));

create policy guestings_select on public.volunteer_guestings for select to authenticated
  using (volunteer_id in (select id from public.volunteers where profile_id = auth.uid())
         or public.has_permission(auth.uid(), 'guesting.decide', 'organization', home_org_id)
         or public.has_permission(auth.uid(), 'guesting.decide', 'organization', host_org_id)
         or public.has_permission(auth.uid(), 'volunteers.read.all'));
