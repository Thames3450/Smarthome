import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mem=new Map();
globalThis.localStorage={getItem:key=>mem.get(key)||null,setItem:(key,v)=>mem.set(key,String(v)),removeItem:k=>mem.delete(k)};
globalThis.sessionStorage={getItem:key=>mem.get(key)||null,setItem:(key,v)=>mem.set(key,String(v)),removeItem:k=>mem.delete(k)};
const {demo,resetDemo}=await import('../src/demo.js');
const {configured}=await import('../src/cloud.js');

test('Demo starts with multiple isolated homes',async()=>{
 resetDemo();const homes=await demo.getHomes();assert.equal(homes.length,2);
 assert.equal((await demo.getDevices(homes[0].id)).length,7);
 assert.equal((await demo.getDevices(homes[1].id)).length,1);
});
test('Rooms can be created, deleted, and devices unassigned',async()=>{
 resetDemo();const home='home-demo-1';const room=await demo.createRoom(home,'Office');
 assert.ok((await demo.getRooms(home)).find(x=>x.id===room.id));
 await demo.updateDevice('dev-1',{room_id:room.id});
 await demo.removeRoom(room.id);
 assert.equal((await demo.getDevices(home)).find(x=>x.id==='dev-1').room_id,null);
});
test('Manual commands only control switch-capable devices',async()=>{
 resetDemo();
 await demo.command('home-demo-1','dev-2',false);
 assert.equal((await demo.getDevices('home-demo-1')).find(x=>x.id==='dev-2').relay_state,false);
 await assert.rejects(()=>demo.command('home-demo-1','dev-1',true),/ไม่รองรับการควบคุม/);
});
test('Meter totals and cost are distinctly labeled as sample data',async()=>{
 resetDemo();const x=await demo.getDashboard('home-demo-1');
 assert.ok(x.estimate_cost>0&&x.history.length===7&&x.device_count===7);
 const ui=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(ui,/โหมดสาธิต/);assert.match(ui,/ข้อมูลจำลอง/);
 assert.match(ui,/มิเตอร์ไฟฟ้าหลัก/);
});
test('Home, automation, and member features expose CRUD API',async()=>{
 resetDemo();const id=await demo.createHome('New House');
 assert.ok((await demo.getHomes()).some(x=>x.id===id));
 const rule=await demo.addAutomation({home_id:id,name:'Test',enabled:true});
 await demo.updateAutomation(rule.id,{enabled:false});
 assert.equal((await demo.getAutomations(id))[0].enabled,false);
 await demo.removeAutomation(rule.id);assert.equal((await demo.getAutomations(id)).length,0);
});
test('Cloud configuration never requires a service role key in browser',()=>{
 globalThis.window={SMART_HOME_CONFIG:{SUPABASE_URL:'',SUPABASE_ANON_KEY:''}};
 assert.equal(configured(),false);
 const browser=fs.readFileSync(new URL('../config.js',import.meta.url),'utf8');
 assert.match(browser,/NEVER put SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(browser,/sb_secret_[A-Za-z0-9]{10,}/);
});
test('Cloud database includes RLS, pairing, audit trail and authoritative meter',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/202610080001_initial.sql',import.meta.url),'utf8');
 for(const t of ['homes','home_members','rooms','devices','device_credentials','pending_pairings','energy_readings','device_commands','automations','automation_runs','notifications'])
  assert.match(sql,new RegExp(`alter table public\\.${t} enable row level security`));
 assert.match(sql,/complete_device_claim/);
 assert.match(sql,/billing_meter_id/);
 assert.match(sql,/grant execute on function public\.complete_device_claim\([^;]+service_role/s);
});
test('Cloud source uses TLS and never disables SSL verification in firmware',()=>{
 const fw=fs.readFileSync(new URL('../firmware/esp32c6-smarthome/src/main.cpp',import.meta.url),'utf8');
 assert.match(fw,/setCACert\(CLOUD_ROOT_CA\)/);
 assert.doesNotMatch(fw,/setInsecure\s*\(/);
 assert.match(fw,/ENABLE_RELAY_OUTPUT/);
});

test('One main meter per home; smart switches can still be added',async()=>{
 resetDemo();
 await assert.rejects(()=>demo.claimDevice({home_id:'home-demo-1',kind:'energy_meter',name:'Duplicate'}),/มิเตอร์หลัก/);
 const result=await demo.claimDevice({home_id:'home-demo-1',kind:'smart_switch',name:'New Switch'});
 const devices=await demo.getDevices('home-demo-1');
 assert.equal(devices.filter(d=>d.kind==='energy_meter').length,1);
 assert.equal(devices.find(d=>d.id===result.device_id)?.control_enabled,true);
 const panel=await demo.getDashboard('home-demo-1');
 assert.equal(panel.power_w,842,'The main meter is the only whole-home power source');
 assert.equal(panel.billing_meter_id,'dev-1');
});
test('Light theme is enabled and main meter uniqueness is enforced in SQL',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const light=fs.readFileSync(new URL('../src/light.css',import.meta.url),'utf8');
 const sql=fs.readFileSync(new URL('../supabase/migrations/202610080002_one_main_meter.sql',import.meta.url),'utf8');
 assert.match(html,/src\/light\.css/);
 assert.match(light,/color-scheme:light/);
 assert.match(sql,/unique index if not exists one_main_meter_per_home/);
 assert.match(sql,/enforce_main_meter_read_only/);
});
