-- SDZ FÁZA 7: sťažnosti, pozastavenie organizácií, ochrana osobných údajov (GDPR)

insert into public.permissions (key, scope, description) values
  ('complaints.read', 'system', 'Čítanie sťažností'),
  ('complaints.manage', 'system', 'Riešenie sťažností'),
  ('orgs.suspend', 'system', 'Pozastavenie a obnovenie organizácie'),
  ('gdpr.manage', 'system', 'Vybavovanie žiadostí o osobné údaje'),
  ('complaints.respond', 'organization', 'Vyjadrenie organizácie k sťažnosti');

with m(role_key, perms) as (values
  ('president', array['complaints.read','complaints.manage','orgs.suspend','gdpr.manage']),
  ('secretary_general', array['complaints.read','complaints.manage','orgs.suspend','gdpr.manage']),
  ('admin', array['complaints.read','complaints.manage','gdpr.manage']),
  ('auditor', array['complaints.read']),
  ('org_owner', array['complaints.respond']),
  ('org_chairman', array['complaints.respond']),
  ('org_administrator', array['complaints.respond'])
)
insert into public.role_permissions (role_id, permission_key)
select r.id, p from m join public.roles r on r.key = m.role_key, unnest(m.perms) p;

-- ============ SŤAŽNOSTI ============
create sequence public.complaint_seq;

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_number text not null unique,
  submitter_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('organization', 'event', 'volunteer', 'sdz', 'other')),
  target_org_id uuid references public.organizations(id),
  target_event_id uuid references public.events(id),
  subject text not null check (char_length(subject) between 3 and 200),
  body text not null check (char_length(body) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'in_review', 'needs_info', 'resolved', 'rejected', 'withdrawn')),
  resolution text,
  handled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index complaints_submitter_idx on public.complaints (submitter_id, created_at desc);
create index complaints_status_idx on public.complaints (status, created_at);

create table public.complaint_messages (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id),
  author_id uuid not null references public.profiles(id),
  author_kind text not null check (author_kind in ('submitter', 'staff')),
  internal boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (not internal or author_kind = 'staff')
);
create index complaint_messages_idx on public.complaint_messages (complaint_id, created_at);
create trigger complaint_messages_immutable before update or delete on public.complaint_messages
  for each row execute function public.immutable_row();

create table public.complaint_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id),
  actor_id uuid references public.profiles(id),
  event text not null,
  note text,
  created_at timestamptz not null default now()
);
create trigger complaint_history_immutable before update or delete on public.complaint_history
  for each row execute function public.immutable_row();

create table public.complaint_statements (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id),
  organization_id uuid not null references public.organizations(id),
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '14 days',
  body text check (body is null or char_length(body) between 10 and 4000),
  answered_by uuid references public.profiles(id),
  answered_at timestamptz,
  unique (complaint_id, organization_id)
);

create function public.guard_complaint() returns trigger
language plpgsql as $$
begin
  if current_setting('sdz.fn', true) is distinct from '1' then raise exception 'FORBIDDEN'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger complaints_guard before update on public.complaints
  for each row execute function public.guard_complaint();
create trigger audit_complaints after insert or update on public.complaints
  for each row execute function public.audit_row();

create function public.can_see_complaint(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.complaints c where c.id = p_id and c.submitter_id = auth.uid())
    or public.has_permission(auth.uid(), 'complaints.read'))
$$;

alter table public.complaints enable row level security;
alter table public.complaint_messages enable row level security;
alter table public.complaint_history enable row level security;
alter table public.complaint_statements enable row level security;
create policy complaints_select on public.complaints for select using (public.can_see_complaint(id));
create policy complaint_messages_select on public.complaint_messages for select
  using (public.can_see_complaint(complaint_id)
         and (not internal or public.has_permission(auth.uid(), 'complaints.read')));
create policy complaint_history_select on public.complaint_history for select
  using (public.can_see_complaint(complaint_id));
create policy complaint_statements_select on public.complaint_statements for select
  using (public.has_permission(auth.uid(), 'complaints.read')
         or public.has_permission(auth.uid(), 'complaints.respond', 'organization', organization_id));

create function public.submit_complaint(p_target_type text, p_org uuid, p_event uuid, p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_org uuid := p_org;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_target_type not in ('organization', 'event', 'volunteer', 'sdz', 'other') then raise exception 'INVALID_INPUT'; end if;
  if char_length(trim(coalesce(p_subject, ''))) < 3 or char_length(trim(coalesce(p_body, ''))) < 10 then raise exception 'INVALID_INPUT'; end if;
  if (select count(*) from public.complaints where submitter_id = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'RATE_LIMIT';
  end if;
  if p_event is not null then
    select organization_id into v_org from public.events where id = p_event;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  if v_org is not null and not exists (select 1 from public.organizations where id = v_org) then raise exception 'NOT_FOUND'; end if;
  perform set_config('sdz.fn', '1', true);
  insert into public.complaints (complaint_number, submitter_id, target_type, target_org_id, target_event_id, subject, body)
  values ('SDZ-S-' || lpad(nextval('public.complaint_seq')::text, 6, '0'), auth.uid(), p_target_type, v_org, p_event, trim(p_subject), trim(p_body))
  returning id into v_id;
  insert into public.complaint_history (complaint_id, actor_id, event) values (v_id, auth.uid(), 'submitted');
  return v_id;
end $$;

create function public.withdraw_complaint(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.complaints%rowtype;
begin
  select * into c from public.complaints where id = p_id for update;
  if not found or c.submitter_id is distinct from auth.uid() then raise exception 'NOT_FOUND'; end if;
  if c.status not in ('new', 'in_review', 'needs_info') then raise exception 'INVALID_STATE'; end if;
  perform set_config('sdz.fn', '1', true);
  update public.complaints set status = 'withdrawn', closed_at = now() where id = p_id;
  insert into public.complaint_history (complaint_id, actor_id, event) values (p_id, auth.uid(), 'withdrawn');
end $$;

create function public.set_complaint_status(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c public.complaints%rowtype; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'complaints.manage') then raise exception 'FORBIDDEN'; end if;
  select * into c from public.complaints where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if c.submitter_id = auth.uid() then raise exception 'FORBIDDEN'; end if; -- vlastnú sťažnosť nemožno riešiť
  if p_status not in ('in_review', 'needs_info', 'resolved', 'rejected') then raise exception 'INVALID_INPUT'; end if;
  if c.status in ('resolved', 'rejected', 'withdrawn') then raise exception 'INVALID_STATE'; end if;
  if p_status in ('needs_info', 'resolved', 'rejected') and (v_note is null or char_length(v_note) < 5) then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('sdz.fn', '1', true);
  update public.complaints set status = p_status, handled_by = auth.uid(),
         resolution = case when p_status in ('resolved', 'rejected') then v_note else resolution end,
         closed_at = case when p_status in ('resolved', 'rejected') then now() end
   where id = p_id;
  insert into public.complaint_history (complaint_id, actor_id, event, note) values (p_id, auth.uid(), p_status, v_note);
  if v_note is not null and p_status = 'needs_info' then
    insert into public.complaint_messages (complaint_id, author_id, author_kind, body) values (p_id, auth.uid(), 'staff', v_note);
  end if;
  perform public.notify(c.submitter_id, 'complaint.' || p_status,
    case p_status when 'in_review' then 'Sťažnosť sa rieši' when 'needs_info' then 'K sťažnosti potrebujeme doplnenie'
                  when 'resolved' then 'Sťažnosť bola vyriešená' else 'Sťažnosť bola uzavretá' end,
    c.complaint_number || coalesce(': ' || v_note, ''), '/account/complaints');
end $$;

create function public.add_complaint_message(p_id uuid, p_body text, p_internal boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c public.complaints%rowtype; v_staff boolean; v_body text := trim(coalesce(p_body, ''));
begin
  select * into c from public.complaints where id = p_id;
  if not found or not public.can_see_complaint(p_id) then raise exception 'NOT_FOUND'; end if;
  if v_body = '' then raise exception 'INVALID_INPUT'; end if;
  if c.status in ('resolved', 'rejected', 'withdrawn') then raise exception 'INVALID_STATE'; end if;
  v_staff := public.has_permission(auth.uid(), 'complaints.manage') and c.submitter_id <> auth.uid();
  if not v_staff and c.submitter_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if p_internal and not v_staff then raise exception 'FORBIDDEN'; end if;
  insert into public.complaint_messages (complaint_id, author_id, author_kind, internal, body)
  values (p_id, auth.uid(), case when v_staff then 'staff' else 'submitter' end, p_internal and v_staff, v_body);
  if v_staff and not p_internal then
    perform public.notify(c.submitter_id, 'complaint.message', 'Nová správa k sťažnosti', c.complaint_number, '/account/complaints');
  end if;
end $$;

create function public.request_statement(p_id uuid, p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.complaints%rowtype;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'complaints.manage') then raise exception 'FORBIDDEN'; end if;
  select * into c from public.complaints where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if c.submitter_id = auth.uid() then raise exception 'FORBIDDEN'; end if;
  if c.status in ('resolved', 'rejected', 'withdrawn') then raise exception 'INVALID_STATE'; end if;
  if not exists (select 1 from public.organizations where id = p_org) then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from public.complaint_statements where complaint_id = p_id and organization_id = p_org) then raise exception 'ALREADY_EXISTS'; end if;
  insert into public.complaint_statements (complaint_id, organization_id, requested_by) values (p_id, p_org, auth.uid());
  insert into public.complaint_history (complaint_id, actor_id, event, note) values (p_id, auth.uid(), 'statement_requested', p_org::text);
  perform public.audit_write('complaint.statement_requested', 'complaints', p_id::text, null, jsonb_build_object('org', p_org));
  perform public.notify_org_staff(p_org, 'complaints.respond', 'complaint.statement', 'Žiadosť o vyjadrenie k sťažnosti', c.subject, '/organization/complaints');
end $$;

create function public.answer_statement(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.complaint_statements%rowtype; v_body text := trim(coalesce(p_body, ''));
begin
  select * into s from public.complaint_statements where id = p_id for update;
  if not found or auth.uid() is null
     or not public.has_permission(auth.uid(), 'complaints.respond', 'organization', s.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if s.answered_at is not null then raise exception 'INVALID_STATE'; end if;
  if char_length(v_body) < 10 then raise exception 'INVALID_INPUT'; end if;
  update public.complaint_statements set body = v_body, answered_by = auth.uid(), answered_at = now() where id = p_id;
  perform set_config('sdz.fn', '1', true);
  insert into public.complaint_history (complaint_id, actor_id, event) values (s.complaint_id, auth.uid(), 'statement_received');
  perform public.audit_write('complaint.statement_answered', 'complaints', s.complaint_id::text);
end $$;

-- organizácia vidí iba obsah sťažnosti, nie totožnosť podávateľa
create function public.list_org_complaints(p_org uuid) returns table (
  statement_id uuid, complaint_number text, subject text, body text, status text,
  requested_at timestamptz, due_at timestamptz, answer text, answered_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'complaints.respond', 'organization', p_org) then
    raise exception 'FORBIDDEN';
  end if;
  return query
  select s.id, c.complaint_number, c.subject, c.body, c.status, s.requested_at, s.due_at, s.body, s.answered_at
    from public.complaint_statements s join public.complaints c on c.id = s.complaint_id
   where s.organization_id = p_org order by s.requested_at desc;
end $$;

-- ============ POZASTAVENIE ORGANIZÁCIE ============
create table public.organization_suspensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  reason text not null check (char_length(reason) >= 10),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'lifted', 'expired')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  lifted_by uuid references public.profiles(id),
  lifted_at timestamptz,
  lift_note text,
  check (ends_at is null or ends_at > starts_at)
);
create unique index one_open_suspension on public.organization_suspensions (organization_id)
  where status in ('scheduled', 'active');
alter table public.organization_suspensions enable row level security;
create policy suspensions_select on public.organization_suspensions for select
  using (public.has_permission(auth.uid(), 'orgs.read')
         or public.has_permission(auth.uid(), 'org.view', 'organization', organization_id));
create trigger audit_suspensions after insert or update on public.organization_suspensions
  for each row execute function public.audit_row();

create function public.suspend_organization(p_org uuid, p_reason text, p_starts timestamptz default null, p_ends timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare o public.organizations%rowtype; v_start timestamptz := coalesce(p_starts, now()); v_now boolean;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'orgs.suspend') then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'REASON_REQUIRED'; end if;
  if p_ends is not null and p_ends <= v_start then raise exception 'INVALID_TIME'; end if;
  select * into o from public.organizations where id = p_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status <> 'approved' then raise exception 'INVALID_STATE'; end if;
  if exists (select 1 from public.organization_suspensions where organization_id = p_org and status in ('scheduled', 'active')) then
    raise exception 'ALREADY_EXISTS';
  end if;
  v_now := v_start <= now();
  insert into public.organization_suspensions (organization_id, reason, starts_at, ends_at, status, created_by)
  values (p_org, trim(p_reason), v_start, p_ends, case when v_now then 'active' else 'scheduled' end, auth.uid());
  if v_now then
    perform set_config('sdz.fn', '1', true);
    update public.organizations set status = 'suspended' where id = p_org;
  end if;
  perform public.audit_write('organization.suspend', 'organizations', p_org::text, null,
    jsonb_build_object('reason', trim(p_reason), 'starts_at', v_start, 'ends_at', p_ends), 'warning');
end $$;

create function public.lift_suspension(p_org uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s public.organization_suspensions%rowtype;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'orgs.suspend') then raise exception 'FORBIDDEN'; end if;
  select * into s from public.organization_suspensions where organization_id = p_org and status in ('scheduled', 'active') for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.organization_suspensions set status = 'lifted', lifted_by = auth.uid(), lifted_at = now(), lift_note = nullif(trim(coalesce(p_note, '')), '')
   where id = s.id;
  if s.status = 'active' then
    perform set_config('sdz.fn', '1', true);
    update public.organizations set status = 'approved' where id = p_org and status = 'suspended';
  end if;
  perform public.audit_write('organization.lift_suspension', 'organizations', p_org::text, null, jsonb_build_object('note', p_note), 'warning');
end $$;

-- plánované začiatky a konce (volá cron)
create function public.apply_suspensions() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; n_start int := 0; n_end int := 0;
begin
  perform set_config('sdz.fn', '1', true);
  for r in select * from public.organization_suspensions where status = 'scheduled' and starts_at <= now() for update loop
    if exists (select 1 from public.organizations where id = r.organization_id and status = 'approved') then
      update public.organizations set status = 'suspended' where id = r.organization_id;
      update public.organization_suspensions set status = 'active' where id = r.id;
      n_start := n_start + 1;
    else
      update public.organization_suspensions set status = 'lifted', lifted_at = now(), lift_note = 'automaticky: organizácia nie je schválená' where id = r.id;
    end if;
  end loop;
  for r in select * from public.organization_suspensions where status = 'active' and ends_at is not null and ends_at <= now() for update loop
    update public.organizations set status = 'approved' where id = r.organization_id and status = 'suspended';
    update public.organization_suspensions set status = 'expired' where id = r.id;
    n_end := n_end + 1;
  end loop;
  return jsonb_build_object('suspensions_started', n_start, 'suspensions_ended', n_end);
end $$;
revoke execute on function public.apply_suspensions() from public, anon, authenticated;

-- ============ OCHRANA OSOBNÝCH ÚDAJOV ============
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('access', 'rectification', 'erasure', 'restriction', 'objection')),
  note text check (note is null or char_length(note) <= 2000),
  status text not null default 'open' check (status in ('open', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '30 days',
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  resolution text
);
create unique index one_open_data_request on public.data_requests (user_id, kind) where status = 'open';
alter table public.data_requests enable row level security;
create policy data_requests_select on public.data_requests for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'gdpr.manage'));
create trigger audit_data_requests after insert or update on public.data_requests
  for each row execute function public.audit_row();

create function public.request_data_action(p_kind text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_kind not in ('access', 'rectification', 'erasure', 'restriction', 'objection') then raise exception 'INVALID_INPUT'; end if;
  if exists (select 1 from public.data_requests where user_id = auth.uid() and kind = p_kind and status = 'open') then raise exception 'ALREADY_EXISTS'; end if;
  insert into public.data_requests (user_id, kind, note) values (auth.uid(), p_kind, nullif(trim(coalesce(p_note, '')), '')) returning id into v_id;
  return v_id;
end $$;

create function public.handle_data_request(p_id uuid, p_status text, p_resolution text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.data_requests%rowtype;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'gdpr.manage') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('done', 'rejected') then raise exception 'INVALID_INPUT'; end if;
  if char_length(trim(coalesce(p_resolution, ''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
  select * into d from public.data_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.status <> 'open' then raise exception 'INVALID_STATE'; end if;
  if d.user_id = auth.uid() then raise exception 'FORBIDDEN'; end if; -- vlastnú žiadosť rieši iná osoba
  update public.data_requests set status = p_status, handled_by = auth.uid(), handled_at = now(), resolution = trim(p_resolution) where id = p_id;
  perform public.notify(d.user_id, 'gdpr.' || p_status, 'Vaša žiadosť o osobné údaje bola vybavená', trim(p_resolution), '/account/privacy');
end $$;

-- úplný export údajov prihláseného používateľa (právo na prístup a prenosnosť)
create function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_vol uuid; j jsonb;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select id into v_vol from public.volunteers where profile_id = auth.uid();
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'avatar_path' from public.profiles p where p.id = auth.uid()),
    'volunteer', (select jsonb_build_object('registration_number', v.registration_number, 'status', v.status, 'created_at', v.created_at) from public.volunteers v where v.id = v_vol),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('organization', o.name, 'status', m.status, 'started_at', m.started_at, 'ended_at', m.ended_at))
        from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.volunteer_id = v_vol), '[]'),
    'licenses', coalesce((select jsonb_agg(jsonb_build_object('number', l.license_number, 'issued_on', l.issued_on, 'expires_on', l.expires_on, 'status', l.status))
        from public.volunteer_licenses l where l.volunteer_id = v_vol), '[]'),
    'applications', coalesce((select jsonb_agg(jsonb_build_object('event', e.title, 'status', a.status, 'submitted_at', a.submitted_at, 'answers', a.answers))
        from public.applications a join public.events e on e.id = a.event_id where a.volunteer_id = v_vol), '[]'),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object('event', e.title, 'in', a.checked_in_at, 'out', a.checked_out_at))
        from public.attendance_records a join public.events e on e.id = a.event_id where a.volunteer_id = v_vol), '[]'),
    'certificates', coalesce((select jsonb_agg(jsonb_build_object('number', c.certificate_number, 'title', c.title, 'hours', c.hours, 'issued_at', c.issued_at, 'revoked_at', c.revoked_at))
        from public.volunteer_certificates c where c.volunteer_id = v_vol), '[]'),
    'complaints', coalesce((select jsonb_agg(jsonb_build_object('number', c.complaint_number, 'subject', c.subject, 'body', c.body, 'status', c.status, 'created_at', c.created_at))
        from public.complaints c where c.submitter_id = auth.uid()), '[]'),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('title', n.title, 'body', n.body, 'created_at', n.created_at))
        from public.notifications n where n.user_id = auth.uid()), '[]'),
    'data_requests', coalesce((select jsonb_agg(jsonb_build_object('kind', d.kind, 'status', d.status, 'created_at', d.created_at))
        from public.data_requests d where d.user_id = auth.uid()), '[]')
  ) into j;
  perform public.audit_write('gdpr.export', 'profiles', auth.uid()::text);
  return j;
end $$;
