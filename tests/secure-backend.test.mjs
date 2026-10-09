import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rd=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=rd('supabase/migrations/202610080004_secure_enrollment_and_meter.sql');
const reg=rd('supabase/functions/device-register/index.ts');
const sync=rd('supabase/functions/device-sync/index.ts');
const fw=rd('firmware/esp32c6-smarthome/src/main.cpp');
const web=rd('src/app.js');
const cloud=rd('src/cloud.js');
test('Enrollment ticket: authenticated home-admin issuance, 48 uppercase hex, server-side expiry',()=>{
  assert.match(sql,/auth\.uid\(\) is null or not public\.can_manage\(p_home\)/);
  assert.match(sql,/gen_random_bytes\(24\)/);
  assert.match(sql,/digest\(upper\(v_ticket\),'sha256'\)/); // case must match device hash
  assert.match(sql,/expires_at>now\(\)/);
  assert.match(sql,/used_at is null/);
  assert.match(sql,/grant execute on function public\.issue_enrollment_ticket\(uuid,text\) to authenticated/);
});
test('Registration cannot create new device without a single-use ticket',()=>{
  assert.match(reg,/\[0-9A-F\]\{48\}/);
  assert.match(reg,/begin_device_enrollment/);
  assert.doesNotMatch(reg,/\.from\('devices'\)\.insert/);
  assert.match(sql,/for update;/);
});
test('Pairing is restricted to original authorized home and cannot claim another home',()=>{
  assert.match(sql,/authorized_home_id=p_home/);
  assert.match(sql,/role in \('owner','admin'\)/);
  assert.match(sql,/from public,anon,authenticated/);
});
test('Meter readings are serialized, rate-limited and protected from reset spikes',()=>{
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/drop trigger if exists energy_delta_before_insert/);
  assert.match(sql,/interval '60 seconds'/);
  assert.match(sql,/when v_prev is null or p_energy<v_prev then 0/);
  assert.match(sync,/rpc\('record_main_meter_sample'/);
});
test('Firmware uses ticket obtained via the local captive setup form, not Cloud Wi-Fi collection',()=>{
  assert.match(fw,/name="ticket"/);
  assert.match(fw,/server\.arg\("ticket"\)/);
  assert.match(fw,/req\["enrollment_ticket"\]=enrollmentTicket/);
  assert.match(fw,/prefs\.remove\("enroll_ticket"\)/);
  assert.match(fw,/prefs\.putBool\("paired",isPaired\)/);
  assert.match(fw,/cmd=="RESET"/);
  assert.match(fw,/setCACert\(CLOUD_ROOT_CA\)/);
  assert.doesNotMatch(fw,/setInsecure\s*\(/);
});
test('Web can issue and copy ticket in Add Device wizard',()=>{
  assert.match(cloud,/issue_enrollment_ticket/);
  assert.match(web,/cloud\.createEnrollment\(state\.homeId,m\.kind\)/);
  assert.match(web,/copy-enrollment/);
  assert.match(web,/คัดลอกรหัสติดตั้ง/);
});
test('Automation scheduler is backed by Vault and a server secret',()=>{
  const cron=rd('sql/cron_every_minute_TEMPLATE.sql');
  assert.match(cron,/vault\.decrypted_secrets/);
  assert.match(cron,/x-cron-secret/);
  assert.match(rd('supabase/functions/run-automations/index.ts'),/Deno\.env\.get\('CRON_SECRET'\)/);
});
test('Sensitive keys are never included in public browser configuration',()=>{
  const conf=rd('config.js');
  assert.doesNotMatch(conf,/SUPABASE_SERVICE_ROLE_KEY\s*:/);
  assert.doesNotMatch(conf,/CRON_SECRET\s*:/);
  assert.match(rd('.gitignore'),/secrets\.h/);
});
