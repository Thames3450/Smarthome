-- Smart Home Cloud - migration 001
-- Apply to a fresh Supabase project using `supabase db push`.
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', created_at timestamptz not null default now()
);
create function public.on_auth_user_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1),''))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.on_auth_user_created();

create table public.homes (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),
  timezone text not null default 'Asia/Bangkok', rate_per_kwh numeric(10,4) not null default 5.0000 check(rate_per_kwh >= 0),
  service_fee numeric(10,2) not null default 0 check(service_fee >= 0),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.home_members (
  home_id uuid not null references public.homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  joined_at timestamptz not null default now(), primary key(home_id,user_id)
);
create index home_members_user_idx on public.home_members(user_id);

-- SECURITY DEFINER helpers avoid recursive membership-policy lookup.
create function public.member_role(p_home uuid) returns text language sql stable security definer set search_path = '' as $$
 select role from public.home_members where home_id=p_home and user_id=(select auth.uid()) limit 1
$$;
create function public.is_home_member(p_home uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.member_role(p_home) is not null
$$;
create function public.can_manage(p_home uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.member_role(p_home) in ('owner','admin')
$$;
create function public.can_operate(p_home uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.member_role(p_home) in ('owner','admin','member')
$$;
create function public.create_home(p_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 100 then raise exception 'Invalid home name'; end if;
 insert into public.homes(name,created_by) values(trim(p_name), auth.uid()) returning id into v_id;
 insert into public.home_members(home_id,user_id,role) values(v_id,auth.uid(),'owner');
 return v_id;
end; $$;

create table public.rooms (
 id uuid primary key default gen_random_uuid(), home_id uuid not null references public.homes(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80), icon text not null default 'door-open',
 created_at timestamptz not null default now()
);
create index rooms_home_idx on public.rooms(home_id);

create table public.devices (
 id uuid primary key default gen_random_uuid(),
 home_id uuid references public.homes(id) on delete cascade, -- NULL until claimed
 room_id uuid references public.rooms(id) on delete set null,
 hardware_id text not null check(length(hardware_id) between 4 and 80),
 name text not null default 'New Device',
 kind text not null check(kind in ('energy_meter','smart_switch','energy_switch','sensor')),
 control_enabled boolean not null default false,
 relay_state boolean not null default false,
 last_seen timestamptz,
 last_power_w numeric(12,2) not null default 0,
 last_voltage_v numeric(10,2), last_current_a numeric(10,3),
 last_energy_kwh numeric(14,4), last_frequency_hz numeric(8,2), last_pf numeric(5,3),
 firmware_version text,
 created_at timestamptz not null default now(),
 constraint room_requires_home check (room_id is null or home_id is not null)
);
create index devices_home_idx on public.devices(home_id);
create unique index devices_hardware_idx on public.devices(hardware_id);

-- Backend-only tables. RLS enabled without user policies, Edge Functions use service-role.
create table public.device_credentials (
 device_id uuid primary key references public.devices(id) on delete cascade,
 token_sha256 text not null check(length(token_sha256)=64), revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.pending_pairings (
 device_id uuid primary key references public.devices(id) on delete cascade,
 code_sha256 text not null unique, expires_at timestamptz not null,
 claimed_at timestamptz, created_at timestamptz not null default now()
);

create table public.energy_readings (
 id bigint generated always as identity primary key,
 home_id uuid not null references public.homes(id) on delete cascade,
 device_id uuid not null references public.devices(id) on delete cascade,
 voltage_v numeric(10,2), current_a numeric(10,3), power_w numeric(12,2),
 energy_kwh numeric(14,4) not null,
 delta_kwh numeric(14,4) not null default 0,
 frequency_hz numeric(8,2), power_factor numeric(5,3),
 created_at timestamptz not null default now()
);
create index readings_home_date_idx on public.energy_readings(home_id, created_at desc);
create index readings_device_date_idx on public.energy_readings(device_id, created_at desc);

-- Intended for serialized readings per device (one device-sync request at a time).
-- A meter reset does not create a negative energy reading or a false bill spike.
create function public.energy_reading_delta() returns trigger language plpgsql set search_path = '' as $$
declare v_prev numeric(14,4);
begin
 select energy_kwh into v_prev from public.energy_readings
 where device_id=new.device_id and created_at<=new.created_at
 order by created_at desc,id desc limit 1;
 new.delta_kwh := case when v_prev is null or new.energy_kwh<v_prev then 0
 else least(new.energy_kwh-v_prev,1000) end;
 return new;
end; $$;
create trigger energy_delta_before_insert before insert on public.energy_readings
 for each row execute function public.energy_reading_delta();

create table public.device_commands (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.homes(id) on delete cascade,
 device_id uuid not null references public.devices(id) on delete cascade,
 desired_state boolean not null, source text not null default 'manual' check(source in ('manual','automation')),
 status text not null default 'pending' check(status in ('pending','acknowledged','failed')),
 requested_by uuid references auth.users(id),
 created_at timestamptz not null default now(), processed_at timestamptz,
 error text
);
create index commands_device_pending_idx on public.device_commands(device_id,created_at) where status='pending';

create table public.automations (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.homes(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 trigger_device_id uuid references public.devices(id) on delete cascade,
 trigger_type text not null check(trigger_type in ('power_above','power_below','offline','daily_time')),
 threshold_w numeric(12,2) check(threshold_w >= 0),
 time_local time,
 target_device_id uuid not null references public.devices(id) on delete cascade,
 desired_state boolean not null, enabled boolean not null default true,
 last_condition_met boolean not null default false,
 last_fired_at timestamptz,
 created_at timestamptz not null default now(),
 constraint trigger_params check (
   (trigger_type='daily_time' and time_local is not null) or
   (trigger_type in ('power_above','power_below') and threshold_w is not null and trigger_device_id is not null) or
   (trigger_type='offline' and trigger_device_id is not null)
 )
);
create index automations_home_idx on public.automations(home_id);
create table public.automation_runs (
 automation_id uuid not null references public.automations(id) on delete cascade,
 period_key text not null, created_at timestamptz not null default now(),
 primary key(automation_id,period_key)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), home_id uuid not null references public.homes(id) on delete cascade,
 title text not null, message text not null, read boolean not null default false,
 created_at timestamptz not null default now()
);

create table public.home_invites (
 id uuid primary key default gen_random_uuid(), home_id uuid not null references public.homes(id) on delete cascade,
 code_sha256 text not null unique, role text not null check(role in ('admin','member','viewer')),
 created_by uuid not null references auth.users(id), expires_at timestamptz not null,
 used_by uuid references auth.users(id), used_at timestamptz
);

-- Database constraints: devices and rooms/automations/commands must belong to the same home.
create function public.check_device_room_home() returns trigger language plpgsql set search_path='' as $$
begin
 if new.room_id is not null and not exists
   (select 1 from public.rooms where id=new.room_id and home_id=new.home_id)
 then raise exception 'Room is not in the device home'; end if;
 return new;
end; $$;
create trigger device_room_home before insert or update on public.devices for each row execute function public.check_device_room_home();
create function public.check_command_home() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists (select 1 from public.devices d where d.id=new.device_id and d.home_id=new.home_id
  and d.control_enabled and d.kind in ('smart_switch','energy_switch'))
 then raise exception 'Device cannot be controlled in this home'; end if;
 return new;
end; $$;
create trigger command_home before insert on public.device_commands for each row execute function public.check_command_home();
create function public.check_automation_home() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists (select 1 from public.devices d where d.id=new.target_device_id and d.home_id=new.home_id
  and d.control_enabled and d.kind in ('smart_switch','energy_switch'))
 then raise exception 'Target is not a controllable device in this home'; end if;
 if new.trigger_device_id is not null and not exists
  (select 1 from public.devices d where d.id=new.trigger_device_id and d.home_id=new.home_id)
 then raise exception 'Trigger is not in this home'; end if;
 return new;
end; $$;
create trigger automation_home before insert or update on public.automations for each row execute function public.check_automation_home();

-- Invitations never expose token after creation; store its hash only.
create function public.create_home_invite(p_home uuid,p_role text default 'member') returns text
language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 if not public.can_manage(p_home) then raise exception 'Permission denied'; end if;
 if p_role not in ('admin','member','viewer') then raise exception 'Invalid role'; end if;
 v_code := encode(extensions.gen_random_bytes(24),'hex');
 insert into public.home_invites(home_id,code_sha256,role,created_by,expires_at)
 values(p_home,encode(extensions.digest(v_code,'sha256'),'hex'),p_role,auth.uid(),now()+interval '24 hours');
 return v_code;
end; $$;
create function public.accept_home_invite(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_inv public.home_invites%rowtype;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 select * into v_inv from public.home_invites
 where code_sha256=encode(extensions.digest(p_code,'sha256'),'hex')
 and used_at is null and expires_at>now() for update;
 if not found then raise exception 'Invalid or expired invite'; end if;
 insert into public.home_members(home_id,user_id,role)
 values(v_inv.home_id,auth.uid(),v_inv.role) on conflict(home_id,user_id) do nothing;
 update public.home_invites set used_by=auth.uid(),used_at=now() where id=v_inv.id;
 return v_inv.home_id;
end; $$;
create function public.remove_device(p_device uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_home uuid;
begin
 select home_id into v_home from public.devices where id=p_device;
 if v_home is null or not public.can_manage(v_home) then raise exception 'Permission denied'; end if;
 delete from public.devices where id=p_device and home_id=v_home;
end; $$;

-- Read-optimized dashboards. SECURITY INVOKER means caller RLS still applies.
create function public.home_dashboard(p_home uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with h as (select * from public.homes where id=p_home and public.is_home_member(p_home)),
 d as (select coalesce(sum(last_power_w),0) power_w, count(*) device_count,
        count(*) filter(where last_seen>now()-interval '90 seconds') online_count
      from public.devices where home_id=p_home),
 e as (select coalesce(sum(delta_kwh) filter(where (r.created_at at time zone h.timezone)::date = (now() at time zone h.timezone)::date),0) today,
        coalesce(sum(delta_kwh) filter(where date_trunc('month', r.created_at at time zone h.timezone) = date_trunc('month',now() at time zone h.timezone)),0) month
      from public.energy_readings r cross join h
      where r.home_id=p_home and r.created_at>now()-interval '40 days'),
 hist as (select jsonb_agg(jsonb_build_object('day',to_char(day,'DD Mon'),'kwh',round(kwh,3)) order by day) points
     from (select gs.day::date day,coalesce(sum(r.delta_kwh),0) kwh
       from h cross join lateral generate_series(
         (now() at time zone h.timezone)::date-6,(now() at time zone h.timezone)::date,'1 day'::interval) gs(day)
       left join public.energy_readings r on r.home_id=p_home
         and (r.created_at at time zone h.timezone)::date=gs.day::date
       group by gs.day) z)
 select jsonb_build_object('power_w',d.power_w,'device_count',d.device_count,
   'online_count',d.online_count,'today_kwh',round(e.today,3),
   'month_kwh',round(e.month,3),'estimate_cost',round(e.month*h.rate_per_kwh+h.service_fee,2),
   'history',coalesce(hist.points,'[]'::jsonb))
 from h cross join d cross join e cross join hist
$$;

-- RLS: enabled on ALL tables including private Edge-only tables.
alter table public.profiles enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.rooms enable row level security;
alter table public.devices enable row level security;
alter table public.device_credentials enable row level security;
alter table public.pending_pairings enable row level security;
alter table public.energy_readings enable row level security;
alter table public.device_commands enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.notifications enable row level security;
alter table public.home_invites enable row level security;

create policy profile_self on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profile_edit on public.profiles for update to authenticated using (id=(select auth.uid())) with check(id=(select auth.uid()));
create policy homes_read on public.homes for select to authenticated using(public.is_home_member(id));
create policy homes_edit on public.homes for update to authenticated using(public.can_manage(id)) with check(public.can_manage(id));
create policy homes_delete on public.homes for delete to authenticated using(public.member_role(id)='owner');
create policy members_read on public.home_members for select to authenticated using(public.is_home_member(home_id));
create policy members_delete on public.home_members for delete to authenticated using(public.member_role(home_id)='owner' and role<>'owner');
create policy rooms_read on public.rooms for select to authenticated using(public.is_home_member(home_id));
create policy rooms_add on public.rooms for insert to authenticated with check(public.can_manage(home_id));
create policy rooms_edit on public.rooms for update to authenticated using(public.can_manage(home_id)) with check(public.can_manage(home_id));
create policy rooms_remove on public.rooms for delete to authenticated using(public.can_manage(home_id));
create policy devices_read on public.devices for select to authenticated using(public.is_home_member(home_id));
create policy devices_edit on public.devices for update to authenticated using(public.can_manage(home_id)) with check(public.can_manage(home_id));
create policy readings_read on public.energy_readings for select to authenticated using(public.is_home_member(home_id));
create policy commands_read on public.device_commands for select to authenticated using(public.is_home_member(home_id));
create policy commands_insert on public.device_commands for insert to authenticated with check(public.can_operate(home_id) and requested_by=(select auth.uid()));
create policy automations_read on public.automations for select to authenticated using(public.is_home_member(home_id));
create policy automations_insert on public.automations for insert to authenticated with check(public.can_operate(home_id));
create policy automations_update on public.automations for update to authenticated using(public.can_operate(home_id)) with check(public.can_operate(home_id));
create policy automations_delete on public.automations for delete to authenticated using(public.can_operate(home_id));
create policy notifications_read on public.notifications for select to authenticated using(public.is_home_member(home_id));
create policy notifications_edit on public.notifications for update to authenticated using(public.is_home_member(home_id)) with check(public.is_home_member(home_id));

-- Remove implicit PostgREST write permissions, grant only explicitly safe columns.
revoke all on public.device_credentials, public.pending_pairings, public.home_invites,
 public.automation_runs from anon, authenticated;
revoke all on public.devices,public.energy_readings,public.device_commands,
 public.automations,public.notifications,public.homes,public.home_members,public.profiles,public.rooms
 from anon,authenticated;
grant select on public.profiles,public.homes,public.home_members,public.rooms,public.devices,
 public.energy_readings,public.device_commands,public.automations,public.notifications to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(name,timezone,rate_per_kwh,service_fee) on public.homes to authenticated;
grant delete on public.homes to authenticated;
grant delete on public.home_members to authenticated;
grant insert(home_id,name,icon),update(name,icon),delete on public.rooms to authenticated;
grant update(name,room_id) on public.devices to authenticated;
grant insert(home_id,device_id,desired_state,source,requested_by) on public.device_commands to authenticated;
grant insert(home_id,name,trigger_device_id,trigger_type,threshold_w,time_local,target_device_id,desired_state,enabled),
 update(name,trigger_device_id,trigger_type,threshold_w,time_local,target_device_id,desired_state,enabled),
 delete on public.automations to authenticated;
grant update(read) on public.notifications to authenticated;
revoke all on function public.member_role(uuid),public.is_home_member(uuid),public.can_manage(uuid),public.can_operate(uuid),
 public.create_home(text),public.create_home_invite(uuid,text),public.accept_home_invite(text),
 public.remove_device(uuid),public.home_dashboard(uuid) from public;
grant execute on function public.member_role(uuid),public.is_home_member(uuid),public.can_manage(uuid),public.can_operate(uuid),
 public.create_home(text),public.create_home_invite(uuid,text),public.accept_home_invite(text),
 public.remove_device(uuid),public.home_dashboard(uuid) to authenticated;

-- Atomic claim, callable ONLY from an Edge Function using the service-role key.
create function public.complete_device_claim(p_code_hash text,p_home uuid,p_room uuid,p_name text,p_user uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_device uuid;
begin
 if not exists(select 1 from public.home_members where home_id=p_home and user_id=p_user
               and role in ('owner','admin')) then raise exception 'Not permitted to pair in this home'; end if;
 if p_room is not null and not exists(select 1 from public.rooms where id=p_room and home_id=p_home)
 then raise exception 'Room is not in home'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'Invalid device name'; end if;
 select pp.device_id into v_device from public.pending_pairings pp
 join public.devices d on d.id=pp.device_id
 where pp.code_sha256=p_code_hash and pp.claimed_at is null and pp.expires_at>now()
   and d.home_id is null for update of pp;
 if v_device is null then raise exception 'Code invalid, expired or already used'; end if;
 update public.devices set home_id=p_home,room_id=p_room,name=trim(p_name) where id=v_device;
 update public.pending_pairings set claimed_at=now() where device_id=v_device;
 return v_device;
end; $$;
revoke all on function public.complete_device_claim(text,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.complete_device_claim(text,uuid,uuid,text,uuid) to service_role;

-- One authoritative billing meter per home avoids double-counting a main meter
-- and downstream branch meters. Defaults to the first paired energy meter.
alter table public.homes add column billing_meter_id uuid references public.devices(id) on delete set null;
create function public.validate_billing_meter() returns trigger language plpgsql set search_path='' as $$
begin
 if new.billing_meter_id is not null and not exists(
   select 1 from public.devices where id=new.billing_meter_id and home_id=new.id
   and kind in ('energy_meter','energy_switch'))
 then raise exception 'Billing meter must be an energy meter in this home'; end if;
 return new;
end; $$;
create trigger billing_meter_valid before update on public.homes for each row execute function public.validate_billing_meter();
grant update(billing_meter_id) on public.homes to authenticated;
create or replace function public.home_dashboard(p_home uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with h as (select * from public.homes where id=p_home and public.is_home_member(p_home)),
 m as (select coalesce(h.billing_meter_id,(
       select dv.id from public.devices dv where dv.home_id=h.id
         and dv.kind in ('energy_meter','energy_switch')
       order by case when dv.kind='energy_meter' then 0 else 1 end,dv.created_at asc,dv.id asc limit 1
      )) id from h),
 d as (select count(*) device_count,
        count(*) filter(where last_seen>now()-interval '90 seconds') online_count
      from public.devices where home_id=p_home),
 watts as (select coalesce((select last_power_w from public.devices where id=(select id from m)),0) power_w),
 e as (select coalesce(sum(delta_kwh) filter(where (r.created_at at time zone h.timezone)::date = (now() at time zone h.timezone)::date),0) today,
        coalesce(sum(delta_kwh) filter(where date_trunc('month',r.created_at at time zone h.timezone) = date_trunc('month',now() at time zone h.timezone)),0) month
      from public.energy_readings r cross join h cross join m
      where r.device_id=m.id and r.home_id=p_home and r.created_at>now()-interval '40 days'),
 hist as (select jsonb_agg(jsonb_build_object('day',to_char(day,'DD Mon'),'kwh',round(kwh,3)) order by day) points
     from (select gs.day::date day,coalesce(sum(r.delta_kwh),0) kwh
       from h cross join m cross join lateral generate_series(
         (now() at time zone h.timezone)::date-6,(now() at time zone h.timezone)::date,'1 day'::interval) gs(day)
       left join public.energy_readings r on r.home_id=p_home and r.device_id=m.id
         and (r.created_at at time zone h.timezone)::date=gs.day::date
       group by gs.day) z)
 select jsonb_build_object('power_w',watts.power_w,'device_count',d.device_count,
   'online_count',d.online_count,'billing_meter_id',m.id,'today_kwh',round(e.today,3),
   'month_kwh',round(e.month,3),'estimate_cost',round(e.month*h.rate_per_kwh+h.service_fee,2),
   'history',coalesce(hist.points,'[]'::jsonb))
 from h cross join m cross join watts cross join d cross join e cross join hist
$$;
-- Also ensure read-only client cannot edit automation run state or action metadata.
