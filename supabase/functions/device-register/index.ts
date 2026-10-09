import { admin, cors, errMessage, preflight, randomHex, respond, sha256 } from '../_shared/common.ts';
// First boot: registration requires a short-lived one-use setup ticket issued by a home admin.
Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return respond({error:'Method not allowed'},405);
  try {
    const body = await req.json();
    const hardwareId = String(body.hardware_id ?? '');
    const kind = String(body.kind ?? 'energy_meter');
    const ticket = String(body.enrollment_ticket ?? '').toUpperCase();
    if (!/^[A-Za-z0-9_:-]{8,80}$/.test(hardwareId)) return respond({error:'Invalid hardware ID'},400);
    if (!['energy_meter','smart_switch','sensor'].includes(kind)) return respond({error:'Invalid device type'},400);
    if (!/^[0-9A-F]{48}$/.test(ticket)) return respond({error:'Setup ticket required (48 hex characters)'},401);
    const db = admin();
    const deviceToken = randomHex(32);
    const pairingCode = randomHex(8).toUpperCase(); // 64-bit; shown only on local setup page / Serial.
    const {data:deviceId,error:de} = await db.rpc('begin_device_enrollment',{
      p_ticket_hash:await sha256(ticket),p_hardware:hardwareId,p_kind:kind,
    });
    if (de || !deviceId) return respond({error:de?.code==='23505'?'Hardware already registered':'Setup ticket invalid, expired, used or device already registered'},409);
    const {error:ce} = await db.from('device_credentials').insert({device_id:deviceId,token_sha256:await sha256(deviceToken)});
    const {error:pe} = await db.from('pending_pairings').update({
      code_sha256:await sha256(pairingCode),expires_at:new Date(Date.now()+30*60_000).toISOString(),
    }).eq('device_id',deviceId);
    if (ce || pe) { await db.from('devices').delete().eq('id',deviceId); return respond({error:'Enrollment failed'},500); }
    return respond({device_id:deviceId,device_token:deviceToken,pairing_code:pairingCode,
      expires_in_seconds:1800});
  } catch (e) { console.error(errMessage(e)); return respond({error:'Invalid request'},400); }
});
