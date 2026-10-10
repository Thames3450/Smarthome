// @ts-nocheck
// Ported from the existing Home Thames business layer; API contracts preserved.
const config=()=>({SUPABASE_URL:import.meta.env.VITE_SUPABASE_URL||'', SUPABASE_ANON_KEY:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||''});
const sessionKey='home_thames_session_v1';
let session;
let refreshPromise=null;
try{session=JSON.parse(sessionStorage.getItem(sessionKey)||'null')}catch{session=null}
export const configured=()=>Boolean(config().SUPABASE_URL&&config().SUPABASE_ANON_KEY);
export const currentSession=()=>session;
export const currentUser=()=>session?.user||null;
const base=()=>String(config().SUPABASE_URL||'').replace(/\/$/,'');
function parseError(body,status){return new Error(body?.message||body?.msg||body?.error_description||body?.error||`Cloud API failed (${status})`)}
async function authFetch(endpoint,payload){
 const r=await fetch(`${base()}/auth/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config().SUPABASE_ANON_KEY},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({})); if(!r.ok)throw parseError(body,r.status);return body;
}
function saveSession(next){
 session={...next,expires_at:next.expires_at||Math.floor(Date.now()/1000)+(next.expires_in||3600)};
 sessionStorage.setItem(sessionKey,JSON.stringify(session));
}
export async function login(email,password){const data=await authFetch('token?grant_type=password',{email,password});saveSession(data);return data.user;}
export async function signup(email,password,display_name){const data=await authFetch('signup',{email,password,data:{display_name}});if(data.access_token)saveSession(data);return data;}
export async function logout(){
 const token=session?.access_token;session=null;sessionStorage.removeItem(sessionKey);
 if(token&&configured()){try{await fetch(`${base()}/auth/v1/logout`,{method:'POST',headers:{apikey:config().SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}})}catch{}}
}
async function validToken(){
 if(!session?.access_token)throw new Error('Please sign in');
 if(Date.now()<((session.expires_at||0)-60)*1000)return session.access_token;
 if(!session.refresh_token){await logout();throw new Error('Session expired; sign in again')}
 // One refresh for all parallel dashboard/API requests.
 if(!refreshPromise){
  refreshPromise=(async()=>{
   try{const next=await authFetch('token?grant_type=refresh_token',{refresh_token:session.refresh_token});saveSession(next);return next.access_token}
   catch(e){await logout();throw e}
   finally{refreshPromise=null}
  })();
 }
 return refreshPromise;
}

async function request(path,{method='GET',body,headers={}}={}){
 const token=await validToken();const r=await fetch(`${base()}${path}`,{
 method,headers:{apikey:config().SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`,
 ...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},
 ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(r.status===204)return null;
 const json=await r.json().catch(()=>({}));if(!r.ok)throw parseError(json,r.status);return json;
}
const url=(table,query)=>`/rest/v1/${table}${query?'?'+query:''}`;
const qp=(items)=>new URLSearchParams(items).toString();
export const cloud={
 async getHomes(){return request(url('homes','select=*&order=created_at.asc'))},
 async createHome(name){return request('/rest/v1/rpc/create_home',{method:'POST',body:{p_name:name}})},
 async removeHome(id){return request(url('homes',qp({id:`eq.${id}`})),{method:'DELETE'})},
 async updateHome(id,patch){return request(url('homes',qp({id:`eq.${id}`,select:'*'})),{method:'PATCH',body:patch,headers:{Prefer:'return=representation'}})},
 async getRooms(home){return request(url('rooms',qp({home_id:`eq.${home}`,select:'*',order:'name.asc'})))},
 async createRoom(home,name){return request('/rest/v1/rooms',{method:'POST',body:{home_id:home,name},headers:{Prefer:'return=representation'}})},
 async removeRoom(id){return request(url('rooms',qp({id:`eq.${id}`})),{method:'DELETE'})},
 async getDevices(home){return request(url('devices',qp({home_id:`eq.${home}`,select:'*',order:'created_at.desc'})))},
 async updateDevice(id,patch){return request(url('devices',qp({id:`eq.${id}`})),{method:'PATCH',body:patch})},
 async removeDevice(id){return request('/rest/v1/rpc/remove_device',{method:'POST',body:{p_device:id}})},
 async createEnrollment(home,kind){return request('/rest/v1/rpc/issue_enrollment_ticket',{method:'POST',body:{p_home:home,p_kind:kind}})},
 async claimDevice(body){return request('/functions/v1/claim-device',{method:'POST',body})},
 async getDashboard(home){return request('/rest/v1/rpc/home_dashboard',{method:'POST',body:{p_home:home}})},
 async getEnergySeries(home,period,anchor){return request('/rest/v1/rpc/home_energy_series',{method:'POST',body:{p_home:home,p_period:period,p_anchor:anchor}})},
 async getHistory(home,device){return request(url('energy_readings',qp({home_id:`eq.${home}`,device_id:`eq.${device}`,select:'created_at,voltage_v,current_a,power_w,energy_kwh,delta_kwh',order:'created_at.desc',limit:'120'})))},
 async getCommands(home){return request(url('device_commands',qp({home_id:`eq.${home}`,select:'*',order:'created_at.desc',limit:'40'})))},
 async command(home,device,state){
  const u=currentUser();if(!u)throw Error('Please sign in');
  return request('/rest/v1/device_commands',{method:'POST',body:{home_id:home,device_id:device,desired_state:state,requested_by:u.id,source:'manual'},headers:{Prefer:'return=representation'}})
 },
 async getAutomations(home){return request(url('automations',qp({home_id:`eq.${home}`,select:'*',order:'created_at.desc'})))},
 async addAutomation(payload){return request('/rest/v1/automations',{method:'POST',body:payload,headers:{Prefer:'return=representation'}})},
 async updateAutomation(id,patch){return request(url('automations',qp({id:`eq.${id}`})),{method:'PATCH',body:patch})},
 async removeAutomation(id){return request(url('automations',qp({id:`eq.${id}`})),{method:'DELETE'})},
 async removeMember(home,user){return request(url('home_members',qp({home_id:`eq.${home}`,user_id:`eq.${user}`})),{method:'DELETE'})},
 async getMembers(home){return request(url('home_members',qp({home_id:`eq.${home}`,select:'*',order:'joined_at.asc'})))},
 async createInvite(home,role){return request('/rest/v1/rpc/create_home_invite',{method:'POST',body:{p_home:home,p_role:role}})},
 async acceptInvite(code){return request('/rest/v1/rpc/accept_home_invite',{method:'POST',body:{p_code:code.trim()}})},
 async getNotifications(home){return request(url('notifications',qp({home_id:`eq.${home}`,select:'*',order:'created_at.desc',limit:'30'})))},
 async readNotification(id){return request(url('notifications',qp({id:`eq.${id}`})),{method:'PATCH',body:{read:true}})},
};
