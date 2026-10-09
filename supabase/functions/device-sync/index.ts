import { admin, errMessage, preflight, respond, sha256 } from '../_shared/common.ts';
const numeric = (x:unknown, min:number, max:number) => typeof x === 'number' && Number.isFinite(x) && x>=min && x<=max ? x : null;
Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return respond({error:'Method not allowed'},405);
  const secret = req.headers.get('x-device-token');
  if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) return respond({error:'Device token required'},401);
  try {
    const body = await req.json();
    const deviceId = String(body.device_id||'');
    if (!/^[\da-f-]{36}$/i.test(deviceId)) return respond({error:'Invalid device ID'},400);
    const db = admin();
    const {data:credential} = await db.from('device_credentials').select('token_sha256,revoked_at')
      .eq('device_id',deviceId).single();
    if (!credential || credential.revoked_at || credential.token_sha256 !== await sha256(secret))
      return respond({error:'Device authorization failed'},401);
    const {data:device} = await db.from('devices').select('id,home_id,kind,control_enabled')
      .eq('id',deviceId).single();
    if (!device) return respond({error:'Device not found'},404);
    const state = body.telemetry && typeof body.telemetry==='object' ? body.telemetry : {};
    const voltage = numeric(state.voltage_v,0,300);
    const current = numeric(state.current_a,0,120);
    const power = numeric(state.power_w,0,40000);
    const energy = numeric(state.energy_kwh,0,100_000_000);
    const frequency = numeric(state.frequency_hz,0,70);
    const pf = numeric(state.power_factor,0,1);
    const patch:Record<string,unknown> = {last_seen:new Date().toISOString(),firmware_version:String(body.firmware_version||'').slice(0,30)};
    // Only the dedicated MAIN meter contributes telemetry to whole-home energy.
    if (device.kind === 'energy_meter') {
      if (power!==null) patch.last_power_w=power;
      if (voltage!==null) patch.last_voltage_v=voltage;
      if (current!==null) patch.last_current_a=current;
      if (energy!==null) patch.last_energy_kwh=energy;
      if (frequency!==null) patch.last_frequency_hz=frequency;
      if (pf!==null) patch.last_pf=pf;
    }
    if (device.control_enabled && typeof body.relay_state==='boolean') patch.relay_state=body.relay_state;
    const {error:updateError} = await db.from('devices').update(patch).eq('id',deviceId);
    if (updateError) throw updateError;
    if (device.home_id && device.kind === 'energy_meter' && energy!==null) {
      const {error:readingError} = await db.rpc('record_main_meter_sample',{
        p_device:deviceId,p_energy:energy,p_voltage:voltage,p_current:current,
        p_power:power,p_frequency:frequency,p_pf:pf,
      });
      if (readingError) throw readingError;
    }
    if (Array.isArray(body.acks)) for(const ack of body.acks.slice(0,8)) {
      if (!/^[\da-f-]{36}$/i.test(String(ack.id))) continue;
      const status = ack.success===true?'acknowledged':'failed';
      await db.from('device_commands').update({status,processed_at:new Date().toISOString(),
        error:status==='failed'?'Device rejected command':null})
        .eq('id',String(ack.id)).eq('device_id',deviceId).eq('status','pending');
    }
    if (!device.home_id) return respond({paired:false,commands:[]});
    // Set-state commands are idempotent. The device acknowledges after applying its output.
    const {data:commands,error:fetchError} = await db.from('device_commands')
      .select('id,desired_state').eq('device_id',deviceId).eq('status','pending')
      .gte('created_at',new Date(Date.now()-120000).toISOString())
      .order('created_at',{ascending:true}).limit(5);
    if(fetchError) throw fetchError;
    return respond({paired:true,commands:device.control_enabled?commands:[]});
  } catch (e) { console.error(errMessage(e)); return respond({error:'Sync failed'},500); }
});
