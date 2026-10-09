import test from 'node:test';
import assert from 'node:assert/strict';

const memo=new Map();
const root={innerHTML:''};
const handlers={};
globalThis.window={SMART_HOME_CONFIG:{SUPABASE_URL:'',SUPABASE_ANON_KEY:''}};
globalThis.localStorage={getItem:k=>memo.get(k)||null,setItem:(k,v)=>memo.set(k,String(v))};
globalThis.sessionStorage={getItem:k=>memo.get(k)||null,setItem:(k,v)=>memo.set(k,String(v))};
globalThis.document={querySelector:s=>s==='#app'?root:null,addEventListener:(event,fn)=>{handlers[event]=fn},visibilityState:'visible'};
globalThis.location={protocol:'http:'};
globalThis.setInterval=()=>0;
await import('../src/app.js');
await new Promise(resolve=>setTimeout(resolve,30));

test('Demo shell renders dashboard without JavaScript exceptions',()=>{
 assert.match(root.innerHTML,/Home Thames/);
 assert.match(root.innerHTML,/กราฟการใช้ไฟฟ้า/);
 assert.match(root.innerHTML,/โหมดสาธิต/);
 assert.match(root.innerHTML,/วัดไฟรวมทั้งบ้านจากมิเตอร์ที่ตู้เมน/);
});
async function click(dataset){
 const el={dataset,classList:{contains:()=>false}};
 await handlers.click({target:{closest:()=>el},preventDefault(){}});
}
test('อุปกรณ์ของฉัน page opens and pairing modal renders',async()=>{
 await click({page:'devices'});
 assert.match(root.innerHTML,/อุปกรณ์ของฉัน/);
 await click({act:'add-device'});
 assert.match(root.innerHTML,/เพิ่มอุปกรณ์ใหม่/);
 assert.match(root.innerHTML,/ต้องการเพิ่มอุปกรณ์ชนิดใด/);
 await click({act:'wizard-next'});assert.match(root.innerHTML,/เชื่อมต่อ ESP32/);
 await click({act:'wizard-next'});assert.match(root.innerHTML,/เลือก Wi-Fi บ้าน/);
 await click({act:'wizard-next'});assert.match(root.innerHTML,/pairing_code/);
 await click({act:'close-modal'});
});
test('Energy and automation navigation render expected content',async()=>{
 await click({page:'energy'});
 assert.match(root.innerHTML,/วิเคราะห์การใช้ไฟ/);
 await click({page:'automations'});
 assert.match(root.innerHTML,/ระบบอัตโนมัติ/);
 assert.match(root.innerHTML,/ปิดแอร์เมื่อใช้ไฟเกินกำหนด/);
});
