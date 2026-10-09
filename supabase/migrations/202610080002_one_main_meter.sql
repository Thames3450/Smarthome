-- Home Thames v1.1: only one dedicated main electricity meter per home.
-- PRE-CHECK for existing deployments:
-- select home_id,count(*) from public.devices where home_id is not null
--   and kind='energy_meter' group by home_id having count(*)>1;
-- Resolve any duplicate energy meters before applying this migration.
create unique index if not exists one_main_meter_per_home
  on public.devices(home_id)
  where kind='energy_meter' and home_id is not null;

-- Main metering is read-only; legacy energy_switch may remain for switching,
-- but only a dedicated energy_meter is used for whole-home energy and billing.
create or replace function public.home_dashboard(p_home uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with h as (select * from public.homes where id=p_home and public.is_home_member(p_home)),
 m as (select dv.id,dv.last_power_w,dv.last_seen from public.devices dv join h on dv.home_id=h.id
       where dv.kind='energy_meter' order by dv.created_at asc limit 1),
 d as (select count(*) device_count,
       count(*) filter(where last_seen>now()-interval '90 seconds') online_count
       from public.devices where home_id=p_home),
 e as (select coalesce(sum(delta_kwh) filter(where (r.created_at at time zone h.timezone)::date=(now() at time zone h.timezone)::date),0) today,
        coalesce(sum(delta_kwh) filter(where date_trunc('month',r.created_at at time zone h.timezone)=date_trunc('month',now() at time zone h.timezone)),0) month
      from public.energy_readings r cross join h cross join m
      where r.device_id=m.id and r.home_id=p_home and r.created_at>now()-interval '40 days'),
 hist as (select jsonb_agg(jsonb_build_object('day',to_char(day,'DD Mon'),'kwh',round(kwh,3)) order by day) points
    from (select gs.day::date day,coalesce(sum(r.delta_kwh),0) kwh
      from h cross join lateral generate_series((now() at time zone h.timezone)::date-6,
                 (now() at time zone h.timezone)::date,'1 day'::interval) gs(day)
      left join public.energy_readings r on r.home_id=p_home and r.device_id=(select id from m)
        and (r.created_at at time zone h.timezone)::date=gs.day::date
      group by gs.day) z)
 select jsonb_build_object(
   'power_w',case when m.last_seen>now()-interval '90 seconds' then m.last_power_w else null end,
   'device_count',d.device_count,'online_count',d.online_count,'billing_meter_id',m.id,
   'meter_online',coalesce(m.last_seen>now()-interval '90 seconds',false),
   'today_kwh',round(e.today,3),'month_kwh',round(e.month,3),
   'estimate_cost',round(e.month*h.rate_per_kwh+h.service_fee,2),
   'history',coalesce(hist.points,'[]'::jsonb))
 from h cross join d cross join e cross join hist left join m on true
$$;

-- The main energy meter must never operate a relay through commands.
create or replace function public.enforce_main_meter_read_only() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.kind='energy_meter' and new.control_enabled then
    raise exception 'Main energy meter must be read only';
 end if;
 return new;
end; $$;
drop trigger if exists main_meter_read_only on public.devices;
create trigger main_meter_read_only before insert or update on public.devices
 for each row execute function public.enforce_main_meter_read_only();
