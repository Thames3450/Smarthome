-- Home Thames 2.4: Aggregate the ONE main-panel meter per home, in the home's configured timezone.
-- Never let a client query an arbitrary user's home's history.
create or replace function public.home_energy_series(p_home uuid, p_period text, p_anchor date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tz text;
  v_start timestamp;
  v_end timestamp;
  v_step interval;
  v_bucket text;
  v_result jsonb;
begin
  if p_period not in ('day','week','month','year') or p_anchor is null then
    raise exception 'Invalid energy period or date';
  end if;
  select timezone into v_tz from public.homes
    where id=p_home and public.is_home_member(p_home);
  if v_tz is null then raise exception 'Home not found or access denied'; end if;

  if p_period='day' then
    v_start:=p_anchor::timestamp;
    v_end:=v_start+interval '1 day';
    v_step:=interval '1 hour';
    v_bucket:='hour';
  elsif p_period='week' then
    v_start:=date_trunc('week',p_anchor::timestamp);
    v_end:=v_start+interval '7 days';
    v_step:=interval '1 day';
    v_bucket:='day';
  elsif p_period='month' then
    v_start:=date_trunc('month',p_anchor::timestamp);
    v_end:=v_start+interval '1 month';
    v_step:=interval '1 day';
    v_bucket:='day';
  else
    v_start:=date_trunc('year',p_anchor::timestamp);
    v_end:=v_start+interval '1 year';
    v_step:=interval '1 month';
    v_bucket:='month';
  end if;

  with slots as (
    select generate_series(v_start,v_end-v_step,v_step) as bucket
  ), measured as (
    select date_trunc(v_bucket,r.created_at at time zone v_tz) as bucket,
           sum(r.delta_kwh)::numeric as kwh,
           avg(r.power_w)::numeric as avg_power_w,
           count(*) as samples
    from public.energy_readings r
    join public.devices d on d.id=r.device_id and d.home_id=p_home
       and d.kind='energy_meter'
    where r.home_id=p_home
      and r.created_at >= (v_start at time zone v_tz)
      and r.created_at < (v_end at time zone v_tz)
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket',to_char(s.bucket,'YYYY-MM-DD"T"HH24:MI:SS'),
    'kwh',round(coalesce(m.kwh,0),4),
    'avg_power_w',case when m.avg_power_w is null then null else round(m.avg_power_w,2) end,
    'samples',coalesce(m.samples,0)
  ) order by s.bucket),'[]'::jsonb)
  into v_result
  from slots s left join measured m on m.bucket=s.bucket;
  return v_result;
end; $$;
grant execute on function public.home_energy_series(uuid,text,date) to authenticated;
revoke execute on function public.home_energy_series(uuid,text,date) from anon;
