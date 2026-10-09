import {aggregateDemo,homeToday,sumKwh,shiftPeriod} from './energy.js';
const key='home_thames_demo_v1';
const id=()=>globalThis.crypto?.randomUUID?.()||`demo-${Math.random().toString(36).slice(2)}`;
const hour=(h)=>new Date(Date.now()-h*3600000).toISOString();
const template=()=>({
 homes:[{id:'home-demo-1',name:'บ้านของฉัน',timezone:'Asia/Bangkok',rate_per_kwh:5,service_fee:3,created_at:hour(1000)},
        {id:'home-demo-2',name:'บ้านพักวันหยุด',timezone:'Asia/Bangkok',rate_per_kwh:4.5,service_fee:0,created_at:hour(500)}],
 rooms:[{id:'room-1',home_id:'home-demo-1',name:'ห้องนั่งเล่น'}, {id:'room-2',home_id:'home-demo-1',name:'ห้องนอน'},
        {id:'room-3',home_id:'home-demo-1',name:'ห้องครัว'},{id:'room-5',home_id:'home-demo-1',name:'ห้องทำงาน'},{id:'room-4',home_id:'home-demo-2',name:'ห้องหลัก'}],
 devices:[
  {id:'dev-1',home_id:'home-demo-1',room_id:'room-1',name:'มิเตอร์ไฟฟ้าหลัก',kind:'energy_meter',control_enabled:false,relay_state:false,last_seen:hour(0.003),last_power_w:842,last_voltage_v:227.5,last_current_a:3.7,last_energy_kwh:1284.5,last_frequency_hz:50,last_pf:.98,firmware_version:'1.0.0'},
  {id:'dev-2',home_id:'home-demo-1',room_id:'room-1',name:'ไฟห้องนั่งเล่น',kind:'smart_switch',control_enabled:true,relay_state:true,last_seen:hour(.003),last_power_w:12,last_voltage_v:226,last_current_a:.06,last_energy_kwh:83.2,firmware_version:'1.0.0'},
  {id:'dev-3',home_id:'home-demo-1',room_id:'room-1',name:'เครื่องปรับอากาศ',kind:'smart_switch',control_enabled:true,relay_state:true,last_seen:hour(.004),last_power_w:0,last_voltage_v:229,last_current_a:4.9,last_energy_kwh:320.2,firmware_version:'1.0.0'},
  {id:'dev-4',home_id:'home-demo-1',room_id:'room-3',name:'เซนเซอร์ห้องครัว',kind:'sensor',control_enabled:false,relay_state:false,last_seen:hour(7),last_power_w:0,last_voltage_v:null,last_current_a:null,last_energy_kwh:null,firmware_version:'1.0.0'},
  {id:'dev-6',home_id:'home-demo-1',room_id:'room-1',name:'พัดลมเพดาน',kind:'smart_switch',control_enabled:true,relay_state:false,last_seen:hour(.008),last_power_w:0,firmware_version:'2.0.0'},
  {id:'dev-7',home_id:'home-demo-1',room_id:'room-2',name:'ม่านห้องนอน',kind:'smart_switch',control_enabled:true,relay_state:false,last_seen:hour(.006),last_power_w:0,firmware_version:'2.0.0'},
  {id:'dev-8',home_id:'home-demo-1',room_id:'room-5',name:'ปลั๊กอัจฉริยะห้องทำงาน',kind:'smart_switch',control_enabled:true,relay_state:true,last_seen:hour(.005),last_power_w:0,firmware_version:'2.0.0'},
  {id:'dev-5',home_id:'home-demo-2',room_id:'room-4',name:'มิเตอร์บ้านพัก',kind:'energy_meter',control_enabled:false,relay_state:false,last_seen:hour(.009),last_power_w:265,last_voltage_v:224,last_current_a:1.2,last_energy_kwh:23.8,firmware_version:'1.0.0'},
 ],
 automations:[{id:'rule-1',home_id:'home-demo-1',name:'ปิดแอร์เมื่อใช้ไฟเกินกำหนด',trigger_type:'power_above',threshold_w:2500,trigger_device_id:'dev-1',target_device_id:'dev-3',desired_state:false,enabled:true},
              {id:'rule-2',home_id:'home-demo-1',name:'เปิดไฟเวลา 18:30',trigger_type:'daily_time',time_local:'18:30:00',trigger_device_id:null,target_device_id:'dev-2',desired_state:true,enabled:true}],
 commands:[],notifications:[{id:'n-1',home_id:'home-demo-1',title:'แจ้งเตือนการใช้ไฟฟ้า',message:'มิเตอร์ใช้กำลังไฟเกิน 1.5 kW เวลา 18:20',read:false,created_at:hour(3)}],
 members:[{home_id:'home-demo-1',user_id:'demo-user',role:'owner'}, {home_id:'home-demo-2',user_id:'demo-user',role:'owner'}]
});
let store;try{store=JSON.parse(localStorage.getItem(key)||'null')||template()}catch{store=template()}
const save=()=>localStorage.setItem(key,JSON.stringify(store));
// Upgrade only stock sample labels; preserve custom names and the user's demo records.
const demoLocaleMap={
 'My Home':'บ้านของฉัน','Weekend House':'บ้านพักวันหยุด',
 'Living Room':'ห้องนั่งเล่น','Bedroom':'ห้องนอน','Kitchen':'ห้องครัว','Office':'ห้องทำงาน','Main Room':'ห้องหลัก',
 'Main Energy Meter':'มิเตอร์ไฟฟ้าหลัก','Living Room Light':'ไฟห้องนั่งเล่น','Air Conditioner':'เครื่องปรับอากาศ',
 'Kitchen Sensor':'เซนเซอร์ห้องครัว','Ceiling Fan':'พัดลมเพดาน','Bedroom Curtain':'ม่านห้องนอน',
 'Office Smart Plug':'ปลั๊กอัจฉริยะห้องทำงาน','Holiday Meter':'มิเตอร์บ้านพัก',
 'Turn off AC when power is high':'ปิดแอร์เมื่อใช้ไฟเกินกำหนด','Bedroom light at 18:30':'เปิดไฟเวลา 18:30',
 'Energy usage alert':'แจ้งเตือนการใช้ไฟฟ้า','The energy meter was above 1.5 kW at 18:20':'มิเตอร์ใช้กำลังไฟเกิน 1.5 kW เวลา 18:20'
};
for(const list of ['homes','rooms','devices','automations','notifications'])for(const obj of store[list]||[])
 for(const prop of ['name','title','message'])if(typeof obj[prop]==='string'&&demoLocaleMap[obj[prop]])obj[prop]=demoLocaleMap[obj[prop]];
save();
const by=(name,home)=>store[name].filter(x=>x.home_id===home);
const make=(name,obj)=>{let item={id:id(),created_at:new Date().toISOString(),...obj};store[name].push(item);save();return item};
const nowOnline=d=>d.last_seen && Date.now()-new Date(d.last_seen).getTime()<90000;
export const resetDemo=()=>{store=template();save()};
export const demo={
 async getHomes(){return [...store.homes]},async createHome(name){return make('homes',{name,timezone:'Asia/Bangkok',rate_per_kwh:5,service_fee:0}).id},
 async removeHome(id){for(const tbl of ['rooms','devices','automations','commands','notifications','members'])store[tbl]=store[tbl].filter(x=>x.home_id!==id);store.homes=store.homes.filter(x=>x.id!==id);save()},
 async updateHome(id,patch){Object.assign(store.homes.find(x=>x.id===id),patch);save()},
 async getRooms(home){return by('rooms',home)},async createRoom(home,name){return make('rooms',{home_id:home,name})},
 async removeRoom(id){store.rooms=store.rooms.filter(x=>x.id!==id);store.devices.forEach(x=>{if(x.room_id===id)x.room_id=null});save()},
 async getDevices(home){const result=by('devices',home);for(const d of result)if(d.id!=='dev-4')d.last_seen=new Date(Date.now()-15000).toISOString();return result},async updateDevice(id,patch){Object.assign(store.devices.find(x=>x.id===id),patch);save()},
 async removeDevice(id){store.devices=store.devices.filter(x=>x.id!==id);store.automations=store.automations.filter(x=>x.target_device_id!==id&&x.trigger_device_id!==id);save()},
 async claimDevice(body){const kind=['energy_meter','smart_switch','sensor'].includes(body.kind)?body.kind:'smart_switch';if(kind==='energy_meter'&&by('devices',body.home_id).some(d=>d.kind==='energy_meter'))throw Error('บ้านนี้มีมิเตอร์หลักแล้ว (ได้สูงสุด 1 ตัวต่อบ้าน)');const newid=make('devices',{home_id:body.home_id,room_id:body.room_id||null,name:body.name||'ESP32 ใหม่',kind,control_enabled:kind==='smart_switch',relay_state:false,last_seen:hour(.004),last_power_w:kind==='energy_meter'?420:0,last_voltage_v:kind==='energy_meter'?228:null,last_current_a:kind==='energy_meter'?1.8:null,last_energy_kwh:kind==='energy_meter'?0:null,firmware_version:'1.1.0'});return {device_id:newid.id,paired:true}},
 async getDashboard(home){let devices=by('devices',home);let main=store.homes.find(x=>x.id===home);let meter=devices.find(d=>d.kind==='energy_meter');let p=meter?.last_power_w??null;let base=home==='home-demo-1'?6.85:2.12;
  const baseDate=homeToday(main?.timezone);
  const history=Array.from({length:7},(_,i)=>{const day=shiftPeriod('day',baseDate,i-6);return {day,kwh:+sumKwh(aggregateDemo('day',day,home,baseDate)).toFixed(3)}});
  const today=homeToday(main?.timezone), todayTotal=sumKwh(aggregateDemo('day',today,home,today));
  const monthTotal=sumKwh(aggregateDemo('month',today,home,today));
  return {power_w:p,billing_meter_id:meter?.id||null,device_count:devices.length,online_count:devices.filter(nowOnline).length,today_kwh:todayTotal,month_kwh:monthTotal,estimate_cost:Number((monthTotal*(main?.rate_per_kwh||5)+(main?.service_fee||0)).toFixed(2)),history};
 },
 async getEnergySeries(home,period,anchor){if(!by('devices',home).some(d=>d.kind==='energy_meter'))return [];return aggregateDemo(period,anchor,home,homeToday(store.homes.find(h=>h.id===home)?.timezone))},
 async getHistory(home,device){return Array.from({length:24},(_,i)=>({created_at:hour(23-i),power_w:Math.round(340+Math.sin(i*.7)*210+(i%4)*44),voltage_v:228.3,current_a:2.5,energy_kwh:20+i*.5,delta_kwh:.5})).reverse()},
 async getCommands(home){return by('commands',home)},
 async command(home,device,state){let d=store.devices.find(x=>x.id===device);if(!d||d.home_id!==home||d.kind==='energy_meter'||!d.control_enabled)throw Error('อุปกรณ์นี้ไม่รองรับการควบคุม');d.relay_state=state;const c=make('commands',{home_id:home,device_id:device,desired_state:state,status:'acknowledged',source:'manual',created_at:new Date().toISOString()});save();return [c]},
 async getAutomations(home){return by('automations',home)},async addAutomation(p){return make('automations',p)},
 async updateAutomation(id,patch){Object.assign(store.automations.find(x=>x.id===id),patch);save()},
 async removeAutomation(id){store.automations=store.automations.filter(x=>x.id!==id);save()},
 async removeMember(home,user){store.members=store.members.filter(x=>x.home_id!==home||x.user_id!==user);save()},
 async getMembers(home){return by('members',home)},async createInvite(){return 'DEMO-INVITE-CODE'},async acceptInvite(){return 'home-demo-1'},
 async getNotifications(home){return by('notifications',home)},async readNotification(id){const n=store.notifications.find(x=>x.id===id);if(n)n.read=true;save()},
};
