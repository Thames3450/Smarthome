import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aggregateDemo,homeToday,startOfPeriod,shiftPeriod,shiftMonth,monthLabel,periodLabel,bucketLabel,sumKwh} from '../src/energy.js';

test('Thai-home timezone returns ISO date and readable Thai periods',()=>{
 assert.match(homeToday('Asia/Bangkok'),/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(startOfPeriod('week','2026-10-08'),'2026-10-05');
 assert.equal(startOfPeriod('month','2026-10-08'),'2026-10-01');
 assert.equal(startOfPeriod('year','2026-10-08'),'2026-01-01');
 assert.equal(shiftPeriod('week','2026-10-08',-1),'2026-09-28');
 assert.equal(shiftMonth('2026-01',-1),'2025-12');
 assert.equal(shiftMonth('2026-12',1),'2027-01');
 assert.equal(monthLabel('2026-10'),'ต.ค. 2569');
 assert.match(periodLabel('week','2026-10-08'),/2569/);
 assert.equal(bucketLabel('day','2026-10-08T11:00:00'),'11:00');
});

test('Historical demo periods contain 24 hours, 7 days, actual month days, 12 months',()=>{
 const today='2026-10-08',home='home-demo-1';
 const d=aggregateDemo('day',today,home,today);
 const w=aggregateDemo('week',today,home,today);
 const m=aggregateDemo('month',today,home,today);
 const y=aggregateDemo('year',today,home,today);
 assert.equal(d.length,24);assert.equal(w.length,7);assert.equal(m.length,31);assert.equal(y.length,12);
 assert.equal(aggregateDemo('month','2024-02-10',home,today).length,29);
 assert.equal(aggregateDemo('month','2025-02-10',home,today).length,28);
 assert.ok(sumKwh(d)>0);assert.ok(sumKwh(y)>=sumKwh(m));
 assert.ok(y[10].kwh===0,'future months must not have invented usage');
 assert.ok(m[15].kwh===0,'future days must not have invented usage');
 assert.ok(Math.abs(sumKwh(d)-m[7].kwh)<0.002,'hourly demo data must reconcile with daily demo');
});

test('Cloud request uses RLS-protected per-home main meter aggregation, never sum switches',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/202610080003_energy_history.sql',import.meta.url),'utf8');
 assert.match(sql,/security invoker/);
 assert.match(sql,/public\.is_home_member\(p_home\)/);
 assert.match(sql,/d\.kind='energy_meter'/);
 assert.match(sql,/p_period not in/);
 assert.match(sql,/delta_kwh/);
 assert.match(sql,/p_anchor/);
 const js=readFileSync(new URL('../src/cloud.js',import.meta.url),'utf8');
 assert.match(js,/home_energy_series/);
});

test('Sarabun and all four history periods are available',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/history.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(html,/family=Sarabun/);assert.match(css,/font-family:'Sarabun'/);
 for(const name of ['รายวัน','รายสัปดาห์','รายเดือน','รายปี','ประวัติค่าไฟรายเดือน','data-bill-month','data-energy-month'])assert.ok(js.includes(name),name);
});
