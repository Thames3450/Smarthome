-- Home Thames v2.5 - secure one-use enrollment, home binding, atomic meter writes.
-- Apply AFTER migrations 001, 002 and 003. Do not re-run the initial migration.
create table public.enrollment_tickets (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.homes(id) on delete cascade,
 kind text not null check (kind in ('energy_meter','smart_switch','sensor')),
 secret_sha256 text not null unique check(length(secret_sha256)=64),
 issued_by uuid not null references auth.users(id),
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
create index enrollment_tickets_home_idx on public.enrollment_tickets(home_id,created_at desc);
alter table public.enrollment_tickets enable row level security;
revoke all on public.enrollment_tickets from anon,authenticated;

alter table public.pending_pairings add column authorized_home_id uuid references public.homes(id) on delete cascade;

-- Return a 48-hex-character setup ticket to an authorized home administrator only.
create function public.issue_enrollment_ticket(p_home uuid,p_kind text)
returns text language plpgsql security definer set search_path='' as $$
declare v_ticket text;
begin
 if auth.uid() is null or not public.can_manage(p_home) then raise exception 'Not authorized'; end if;
 if p_kind not in ('energy_meter','smart_switch','sensor') then raise exception 'Invalid kind'; end if;
 if p_kind='energy_meter' and exists(select 1 from public.devices where home_id=p_home and kind='energy_meter')
 then raise exception 'Only one main meter per home'; end if;
 v_ticket:=encode(extensions.gen_random_bytes(24),'hex');
 insert into public.enrollment_tickets(home_id,kind,secret_sha256,issued_by,expires_at)
 values(p_home,p_kind,encode(extensions.digest(upper(v_ticket),'sha256'),'hex'),auth.uid(),now()+interval '15 minutes');
 return upper(v_ticket);
end; $$;
revoke all on function public.issue_enrollment_ticket(uuid,text) from public,anon;
grant execute on function public.issue_enrollment_ticket(uuid,text) to authenticated;

-- Only service_role can consume an enrollment ticket. Locked row prevents replay.
create function public.begin_device_enrollment(p_ticket_hash text,p_hardware text,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_ticket public.enrollment_tickets%rowtype; v_device uuid;
begin
 if current_user not in ('postgres','service_role') then raise exception 'Denied'; end if;
 if p_kind not in ('energy_meter','smart_switch','sensor') or p_hardware !~ '^[A-Za-z0-9_:-]{8,80}$'
 then raise exception 'Invalid device'; end if;
 select * into v_ticket from public.enrollment_tickets
 where secret_sha256=p_ticket_hash and kind=p_kind and used_at is null and expires_at>now()
 for update;
 if not found then raise exception 'Setup ticket invalid, expired or already used'; end if;
 if p_kind='energy_meter' and exists(select 1 from public.devices where home_id=v_ticket.home_id and kind='energy_meter')
 then raise exception 'Main meter already exists'; end if;
 insert into public.devices(hardware_id,kind,name,control_enabled)
 values(p_hardware,p_kind,'Unpaired Device',p_kind='smart_switch') returning id into v_device;
 update public.enrollment_tickets set used_at=now() where id=v_ticket.id;
 insert into public.pending_pairings(device_id,code_sha256,expires_at,authorized_home_id)
 values(v_device,encode(extensions.gen_random_bytes(32),'hex'),now()+interval '1 second',v_ticket.home_id);
 return v_device;
end; $$;
revoke all on function public.begin_device_enrollment(text,text,text) from public,anon,authenticated;
grant execute on function public.begin_device_enrollment(text,text,text) to service_role;

-- Prevent pairing codes from being claimed into an unrelated home.
create or replace function public.complete_device_claim(p_code_hash text,p_home uuid,p_room uuid,p_name text,p_user uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_device uuid;
begin
 if current_user not in ('postgres','service_role') then raise exception 'Denied'; end if;
 if not exists(select 1 from public.home_members where home_id=p_home and user_id=p_user
               and role in ('owner','admin')) then raise exception 'Not permitted to pair in this home'; end if;
 if p_room is not null and not exists(select 1 from public.rooms where id=p_room and home_id=p_home)
 then raise exception 'Room is not in home'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'Invalid device name'; end if;
 select pp.device_id into v_device from public.pending_pairings pp
 join public.devices d on d.id=pp.device_id
 where pp.code_sha256=p_code_hash and pp.claimed_at is null and pp.expires_at>now()
 and pp.authorized_home_id=p_home and d.home_id is null for update of pp;
 if v_device is null then raise exception 'Code invalid, expired, wrong home or already used'; end if;
 update public.devices set home_id=p_home,room_id=p_room,name=trim(p_name) where id=v_device;
 update public.pending_pairings set claimed_at=now() where device_id=v_device;
 return v_device;
end; $$;
revoke all on function public.complete_device_claim(text,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.complete_device_claim(text,uuid,uuid,text,uuid) to service_role;

-- Row lock prevents double-counted delta under concurrent device-sync calls.
-- Discard impossible spikes; retain a zero delta on reset. The site is an ESTIMATE.
drop trigger if exists energy_delta_before_insert on public.energy_readings;
create function public.record_main_meter_sample(
 p_device uuid,p_energy numeric,p_voltage numeric,p_current numeric,
 p_power numeric,p_frequency numeric,p_pf numeric
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_home uuid;v_prev numeric;v_at timestamptz;v_delta numeric;v_hours numeric;
begin
 if current_user not in ('postgres','service_role') then raise exception 'Denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_device::text,7219));
 select home_id into v_home from public.devices where id=p_device and kind='energy_meter' for update;
 if v_home is null then return false; end if;
 if p_energy is null or p_energy<0 or p_energy>100000000 then raise exception 'Bad energy reading'; end if;
 select energy_kwh, created_at into v_prev,v_at from public.energy_readings
 where device_id=p_device order by created_at desc,id desc limit 1;
 if v_at is not null and v_at>now()-interval '60 seconds' then return false; end if;
 v_hours:=greatest(coalesce(extract(epoch from(now()-v_at))/3600.0,0),0);
 v_delta:=case when v_prev is null or p_energy<v_prev then 0
   when (p_energy-v_prev)>greatest(1.0,v_hours*44.0) then 0
   else p_energy-v_prev end;
 insert into public.energy_readings(home_id,device_id,voltage_v,current_a,power_w,energy_kwh,delta_kwh,frequency_hz,power_factor)
 values(v_home,p_device,p_voltage,p_current,p_power,p_energy,v_delta,p_frequency,p_pf);
 return true;
end; $$;
revoke all on function public.record_main_meter_sample(uuid,numeric,numeric,numeric,numeric,numeric,numeric)
 from public,anon,authenticated;
grant execute on function public.record_main_meter_sample(uuid,numeric,numeric,numeric,numeric,numeric,numeric) to service_role;

-- Remove a generated credential if the device never completed pairing within one day.
-- Run by a scheduled trusted service job if desired; never remove active devices.
create function public.cleanup_stale_enrollments() returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if current_user not in ('postgres','service_role') then raise exception 'Denied'; end if;
 delete from public.devices d where d.home_id is null and d.created_at < now()-interval '1 day';
 get diagnostics v_count=row_count;
 delete from public.enrollment_tickets where expires_at<now()-interval '2 days';
 return v_count;
end; $$;
revoke all on function public.cleanup_stale_enrollments() from public,anon,authenticated;
grant execute on function public.cleanup_stale_enrollments() to service_role;
