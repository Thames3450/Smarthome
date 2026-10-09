import { admin, preflight, randomHex, respond, sha256 } from '../_shared/common.ts';
// Unclaimed ESP32 can rotate its expired pairing code, proving device possession.
Deno.serve(async req=>{
 const pf=preflight(req);if(pf)return pf;
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 const token=req.headers.get('x-device-token');
 if(!token || !/^[0-9a-f]{64}$/i.test(token))return respond({error:'Device token required'},401);
 try{
  const {device_id}=await req.json();
  if(!/^[0-9a-f-]{36}$/i.test(device_id))return respond({error:'Invalid device ID'},400);
  const db=admin();
  const {data:cred}=await db.from('device_credentials').select('token_sha256,revoked_at').eq('device_id',device_id).single();
  if(!cred||cred.revoked_at||cred.token_sha256!==await sha256(token))return respond({error:'Unauthorized'},401);
  const {data:device}=await db.from('devices').select('home_id').eq('id',device_id).single();
  if(!device || device.home_id)return respond({error:'Device is already paired or missing'},403);
  const code=randomHex(8).toUpperCase();
  const {error}=await db.from('pending_pairings').update({code_sha256:await sha256(code),
    expires_at:new Date(Date.now()+30*60_000).toISOString(),claimed_at:null}).eq('device_id',device_id).is('claimed_at',null);
  if(error)return respond({error:'Cannot renew pairing'},500);
  return respond({pairing_code:code,expires_in_seconds:1800});
 }catch{return respond({error:'Invalid request'},400)}
});
