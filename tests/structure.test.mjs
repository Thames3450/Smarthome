import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
test('React TypeScript entry exists and Vite scripts run through terminal',()=>{
 assert.match(read('package.json'),/"dev": "vite/);
 assert.match(read('src/main.tsx'),/createRoot/);
 assert.match(read('src/App.tsx'),/Home Thames|home-thames/);
});
test('all uploaded PNG icons copied',()=>{
 const pngs=fs.readdirSync(path.join(root,'public/icons')).filter(f=>f.endsWith('.png'));
 assert.equal(pngs.length,54);
 assert.ok(pngs.every(f=>f.endsWith('--Streamline-Ultimate.png')));
});
test('backend security and main-meter controls preserved',()=>{
 assert.match(read('src/api/cloud.ts'),/device_commands/);
 assert.match(read('src/api/cloud.ts'),/issue_enrollment_ticket/);
 assert.match(read('src/api/cloud.ts'),/home_energy_series/);
 assert.doesNotMatch(read('src/App.tsx'),/SUPABASE_SERVICE_ROLE_KEY/);
});
test('no legacy DOM page injection in React app',()=>{
 const ui=read('src/App.tsx');
 assert.doesNotMatch(ui,/innerHTML\s*=/);
 assert.doesNotMatch(ui,/document\.addEventListener\('click'/);
});
