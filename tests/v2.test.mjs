import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('premium theme, Streamline layer and PWA versioned cache are active',()=>{
 const h=get('index.html'),sw=get('sw.js'),css=get('src/premium.css');
 assert.match(h,/src\/premium\.css/);
 assert.ok(h.indexOf('src/premium.css')>h.indexOf('src/light.css'));
 assert.match(css,/\.usage-panel \.chart-wrap/);
 assert.match(css,/overflow:hidden/);
 assert.match(sw,/home-thames-shell-v2-6/);
 assert.match(sw,/premium\.css/);
 assert.match(h,/src\/icon-theme\.css/);
 assert.ok(h.indexOf('src/icon-theme.css')>h.indexOf('src/premium.css'));
 assert.doesNotMatch(sw,/ICON_ASSETS/);
});
test('v2 device onboarding uses local Wi-Fi portal without collecting house password in cloud UI',()=>{
 const a=get('src/app.js'), fw=get('firmware/esp32c6-smarthome/src/main.cpp');
 assert.match(a,/function renderPairWizard/);
 for(const t of ['เชื่อมต่อ ESP32','เลือก Wi-Fi บ้าน','http:\/\/192.168.4.1','รหัสจับคู่'])assert.ok(a.includes(t));
 assert.doesNotMatch(a,/name="wifi_password"/);
 assert.match(fw,/server\.on\("\/networks"/);
 assert.match(fw,/WiFi\.scanNetworks/);
 assert.match(fw,/name="ssid"/);
 assert.match(fw,/name="password"/);
 assert.match(fw,/setCACert\(CLOUD_ROOT_CA\)/);
 assert.doesNotMatch(fw,/setInsecure/);
});
test('single authoritative energy meter is retained for cost and chart data',()=>{
 const a=get('src/app.js'), sql=get('supabase/migrations/202610080002_one_main_meter.sql');
 assert.match(a,/const mainMeter=/);
 assert.match(a,/m\?miniChart\(history\.map\(h=>h\.kwh\)/);
 assert.match(sql,/one_main_meter_per_home/);
 assert.match(sql,/enforce_main_meter_read_only/);
});
