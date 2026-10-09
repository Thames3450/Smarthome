import { admin, currentUser, errMessage, preflight, respond, sha256 } from '../_shared/common.ts';
Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return respond({error:'Method not allowed'},405);
  const user = await currentUser(req);
  if (!user) return respond({error:'Login required'},401);
  try {
    const {pairing_code,home_id,room_id,name} = await req.json();
    const code = String(pairing_code || '').trim().toUpperCase();
    if (!/^[0-9A-F]{16}$/.test(code)) return respond({error:'Enter 16-character pairing code'},400);
    if (!/^[\da-f-]{36}$/i.test(String(home_id))) return respond({error:'Invalid home'},400);
    const db = admin();
    const {data,error} = await db.rpc('complete_device_claim',{
      p_code_hash:await sha256(code),p_home:home_id,p_room:room_id || null,
      p_name:String(name || 'Smart Device').slice(0,80),p_user:user.id,
    });
    if (error) return respond({error:error.message},403);
    return respond({device_id:data,paired:true});
  } catch (e) { console.error(errMessage(e)); return respond({error:'Invalid request'},400); }
});
