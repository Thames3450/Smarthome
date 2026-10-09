import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('Thai locale is the default across dashboard and setup wizard',()=>{
 const app=get('src/app.js'),html=get('index.html');
 assert.match(html,/<html lang="th">/);
 for(const phrase of ['กำลังไฟขณะนี้','ค่าไฟประมาณการ','วิเคราะห์การใช้ไฟ','เพิ่มอุปกรณ์ใหม่','เลือก Wi-Fi บ้าน','การตั้งค่าบ้าน'])assert.ok(app.includes(phrase),phrase);
});
test('Energy bars resize with actual card width, without fixed SVG ratio',()=>{
 const app=get('src/app.js'),css=get('src/premium.css');
 assert.match(app,/class="usage-bar-chart"/);
 assert.match(css,/grid-template-columns:repeat\(var\(--usage-count\),minmax\(0,1fr\)\)/);
 assert.match(css,/\.usage-bar-track/);
 assert.match(app,/function displayDay/);
});
test('Single meter measurement, unchanged device identifiers',()=>{
 const app=get('src/app.js');
 assert.match(app,/const mainMeter=/);
 assert.match(app,/d\.kind==='energy_meter'/);
 assert.match(app,/m\?miniChart\(history\.map\(h=>h\.kwh\)/);
 assert.match(app,/function renderDevices\(/);
 assert.match(app,/function renderEnergy\(/);
});
