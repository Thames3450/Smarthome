import { admin, errMessage, preflight, respond } from '../_shared/common.ts';
// Invoke once per minute using Supabase Scheduled Edge Functions / an external cron.
// x-cron-secret must be an independently generated 32+ character secret.
Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return respond({error:'Method not allowed'},405);
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || secret.length < 32 || req.headers.get('x-cron-secret')!==secret)
    return respond({error:'Unauthorized'},401);
  try {
    const db = admin(); const now = new Date();
    const {data:rules,error} = await db.from('automations').select('*').eq('enabled',true).limit(1000);
    if(error) throw error;
    const homeIds = Array.from(new Set((rules||[]).map(r=>r.home_id)));
    const deviceIds = Array.from(new Set((rules||[]).flatMap(r=>[r.trigger_device_id,r.target_device_id]).filter(Boolean)));
    const {data:homes} = homeIds.length?await db.from('homes').select('id,timezone').in('id',homeIds):{data:[]};
    const {data:devices} = deviceIds.length?await db.from('devices').select('id,last_power_w,last_seen,control_enabled').in('id',deviceIds):{data:[]};
    const homeMap = new Map((homes||[]).map(h=>[h.id,h]));
    const deviceMap = new Map((devices||[]).map(d=>[d.id,d]));
    let triggered=0;
    for (const rule of rules||[]) {
      const trigger = deviceMap.get(rule.trigger_device_id);
      const target = deviceMap.get(rule.target_device_id);
      if(!target?.control_enabled) continue;
      let condition=false,period='';
      if(rule.trigger_type==='daily_time') {
        const zone=homeMap.get(rule.home_id)?.timezone||'Asia/Bangkok';
        try {
          const local = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
          const p = Object.fromEntries(local.map(x=>[x.type,x.value]));
          const hhmm=`${p.hour}:${p.minute}`;
          condition=hhmm===String(rule.time_local).slice(0,5);
          period=`${p.year}-${p.month}-${p.day}`;
        } catch{ continue; }
      } else if(trigger) {
        const lastSeen=trigger.last_seen?new Date(trigger.last_seen).getTime():0;
        const online=now.getTime()-lastSeen<90_000;
        if(rule.trigger_type==='offline') condition=!online;
        if(rule.trigger_type==='power_above') condition=online && Number(trigger.last_power_w)>Number(rule.threshold_w);
        if(rule.trigger_type==='power_below') condition=online && Number(trigger.last_power_w)<Number(rule.threshold_w);
        // Fire only on false->true transition. If sustained, don't spam every minute.
        period=String(Math.floor(now.getTime()/60000));
      }
      if (!condition) {
        if(rule.last_condition_met) await db.from('automations').update({last_condition_met:false}).eq('id',rule.id);
        continue;
      }
      if(rule.trigger_type!=='daily_time' && rule.last_condition_met) continue;
      // Unique period key prevents duplicate schedules from concurrent cron invocations.
      const {error:runError}=await db.from('automation_runs').insert({automation_id:rule.id,period_key:period});
      if(runError) continue;
      await db.from('device_commands').insert({home_id:rule.home_id,device_id:rule.target_device_id,
        desired_state:rule.desired_state,source:'automation'});
      await db.from('automations').update({last_condition_met:true,last_fired_at:now.toISOString()}).eq('id',rule.id);
      await db.from('notifications').insert({home_id:rule.home_id,title:'Automation executed',message:rule.name});
      triggered++;
    }
    // Expire commands that couldn't be delivered or acknowledged.
    await db.from('device_commands').update({status:'failed',error:'Device offline or no acknowledgement',processed_at:now.toISOString()})
      .eq('status','pending').lt('created_at',new Date(now.getTime()-120000).toISOString());
    return respond({processed:(rules||[]).length,triggered});
  } catch(e) {console.error(errMessage(e));return respond({error:'Automation run failed'},500);}
});
