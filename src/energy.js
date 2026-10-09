// Shared historical-energy date logic. Dates are calendar dates in the home's timezone.
export const PERIODS = ['day','week','month','year'];
export const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const pad = n=>String(n).padStart(2,'0');
const utcDate = iso=>new Date(`${iso.slice(0,10)}T12:00:00Z`);
const dateStr = date=>`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
export function homeToday(tz='Asia/Bangkok'){
 try{const s=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=Object.fromEntries(s.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`}
 catch{return new Date().toISOString().slice(0,10)}
}
export function startOfPeriod(period,anchor){const d=utcDate(anchor);if(period==='week'){const n=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-n)}
 if(period==='month')d.setUTCDate(1);
 if(period==='year'){d.setUTCDate(1);d.setUTCMonth(0)}
 return dateStr(d)
}
export function shiftPeriod(period,anchor,direction){const d=utcDate(startOfPeriod(period,anchor));if(period==='day')d.setUTCDate(d.getUTCDate()+direction);
 if(period==='week')d.setUTCDate(d.getUTCDate()+7*direction);
 if(period==='month')d.setUTCMonth(d.getUTCMonth()+direction);
 if(period==='year')d.setUTCFullYear(d.getUTCFullYear()+direction);
 return dateStr(d)
}
export function shiftMonth(month,direction){return shiftPeriod('month',month+'-01',direction).slice(0,7)}
export const monthLabel = month=>{const [y,m]=month.slice(0,7).split('-').map(Number);return `${TH_MONTHS[m-1]||''} ${y+543}`};
export function periodLabel(period,anchor){const start=startOfPeriod(period,anchor);if(period==='day'){const [y,m,d]=start.split('-').map(Number);return `${d} ${TH_MONTHS[m-1]} ${y+543}`}
 if(period==='week'){const end=shiftPeriod('day',start,6);return `${periodLabel('day',start)} – ${periodLabel('day',end)}`}
 if(period==='month')return monthLabel(start);
 return `ปี ${Number(start.slice(0,4))+543}`}
export function bucketLabel(period,bucket){const [date,time='00:00:00']=String(bucket).split('T');const [y,m,d]=date.split('-').map(Number);if(period==='day')return `${time.slice(0,2)}:00`;
 if(period==='year')return TH_MONTHS[m-1]||'-';return `${d} ${TH_MONTHS[m-1]||''}`;}
export function aggregateDemo(period,anchor,homeId,today=homeToday()){
 const start=startOfPeriod(period,anchor);const sameOrEarlier=date=>date<=today;
 const daily=k=>{
  if(!sameOrEarlier(k))return 0;
  const [y,m,d]=k.split('-').map(Number);
  const seed=(y*37+m*89+d*17+(homeId==='home-demo-1'?23:7));
  return +(homeId==='home-demo-1'?3.5+(seed%31)*0.17:1.1+(seed%17)*0.12).toFixed(3);
 };
 const slots=[];const dt=utcDate(start);
 if(period==='day'){
  const total=daily(start);const factors=Array.from({length:24},(_,i)=>0.5+Math.abs(Math.sin((i+3)*0.31))*1.2+(i>=18&&i<=22?1:0));
  const sum=factors.reduce((a,b)=>a+b,0);
  for(let i=0;i<24;i++){const k=`${start}T${pad(i)}:00:00`;const kwh=+(total*factors[i]/sum).toFixed(4);
   slots.push({bucket:k,kwh,avg_power_w:total===0?null:Math.round(kwh*1000),samples:total===0?0:30})}
 } else {
  const days=period==='week'?7:period==='month'?new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate():12;
  for(let i=0;i<days;i++){
   if(period==='year')dt.setUTCMonth(i);else dt.setUTCDate(Number(start.slice(8))+i);
   const bucket=dateStr(dt)+'T00:00:00';let kwh=0;
   if(period==='year'){
    const mStart=dateStr(dt), monthDays=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate();
    for(let j=0;j<monthDays;j++) kwh+=daily(shiftPeriod('day',mStart,j));
   }else kwh=daily(dateStr(dt));
   slots.push({bucket,kwh:+kwh.toFixed(3),avg_power_w:kwh===0?null:Math.round(period==='year'?kwh*1000/(24*30):kwh*1000/24),samples:kwh?1:0});
  }
 }
 return slots;
}
export const sumKwh=rows=>(rows||[]).reduce((total,row)=>total+(Number(row.kwh)||0),0);
