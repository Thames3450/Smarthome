# Home Thames Cloud v2.5 — ติดตั้ง Backend จริง (Windows + VS Code)

**สถานะ:** ไฟล์โค้ดและ SQL พร้อม Deploy ไปยัง **Supabase Project ใหม่สำหรับ Home Thames โดยเฉพาะ** ยังไม่ได้ Deploy ในบัญชีของคุณโดยอัตโนมัติ โครงการ MPR Maintenance / IJ Maintenance ไม่ได้รับผลกระทบ.

## 1. สร้าง Project แยก

เปิด <https://supabase.com/dashboard> → **New project** → ตั้งชื่อ `Home Thames Smart Home` → เลือก Region ใกล้บ้าน (เช่น Southeast Asia) → ตั้งรหัสผ่านฐานข้อมูลที่รัดกุมและเก็บไว้ให้ปลอดภัย → รอจน Project พร้อม.

ไปที่ **Project Settings → API Keys / Connect** คัดลอก

- `Project URL` เช่น `https://xxxxxxxx.supabase.co`
- `Publishable key` หรือ legacy `anon key` (`sb_publishable_...`)

**ห้ามเผยแพร่** service role key, secret key, database password, หรือ CRON_SECRET ใน GitHub, เว็บไซต์ หรือ firmware. Publishable Key เปิดเผยฝั่ง browser ได้โดยออกแบบให้ใช้คู่กับ RLS.

## 2. ลงฐานข้อมูลและ Backend

ติดตั้ง Node.js LTS ถ้ายังไม่มี และเปิด Terminal ใน VS Code ที่โฟลเดอร์ Home Thames:

```powershell
node --version
npm --version
npm install --save-dev supabase
npx supabase login
npx supabase link --project-ref YOUR_HOME THAMES_PROJECT_REF
npx supabase db push
```

`db push` ต้องรันไฟล์ migration `001`, `002`, `003`, `004` ตามลำดับ ตรวจผล migration ทุกไฟล์ก่อนใช้งาน ห้ามรัน `001` ซ้ำกับฐานข้อมูลที่มีอยู่แล้วโดยตรง.

```powershell
npx supabase functions deploy device-register
npx supabase functions deploy device-renew
npx supabase functions deploy device-sync
npx supabase functions deploy claim-device
npx supabase functions deploy run-automations
```

`supabase/config.toml` กำหนด `verify_jwt = false` กับฟังก์ชันเหล่านี้ เพราะอุปกรณ์ใช้ `x-device-token`, ผู้ใช้ใน claim ใช้ JWT ที่ยืนยันภายใน handler และ Scheduler ใช้ `x-cron-secret`. **ไม่ได้หมายความว่า API ยอมให้เข้าถึงข้อมูลได้โดยไม่ตรวจสิทธิ์**. `device-register` เวอร์ชันนี้ต้องมีรหัสติดตั้งที่เจ้าของบ้านออกให้ก่อน (48 ตัว/15 นาที/ใช้ครั้งเดียว).

## 3. ตั้งระบบ Automation ให้ทำงานทุกนาที

สร้าง secret แยกของตัวเอง ความยาว 32 ตัวขึ้นไปในเครื่องเท่านั้น:

```powershell
# ตัวอย่างเฉพาะวิธีสร้าง Secret - เก็บผลไว้เป็นความลับ ไม่คัดลอกเข้าซอร์สโค้ด
$cronSecret = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npx supabase secrets set "CRON_SECRET=$cronSecret" --project-ref YOUR_HOME THAMES_PROJECT_REF
```

ที่ Supabase SQL Editor เปิดไฟล์ `sql/cron_every_minute_TEMPLATE.sql` แทนค่า `YOUR_HOME THAMES_REF`, `YOUR_PUBLIC_PUBLISHABLE_KEY`, `GENERATE_A_RANDOM_SECRET_32_PLUS_CHARACTERS` (ตัวสุดท้ายต้องเป็น `$cronSecret` ค่าเดียวกับคำสั่งด้านบน). รันเมื่อแน่ใจว่าไม่มี placeholder แล้ว. ระบบใช้ pg_cron + pg_net + Vault เพื่อเก็บความลับของ Scheduler.

ไปที่ **Integrations → Cron** ดู job `homiq-automation-minute` และตรวจ Log ว่ารันทุกนาที. **หากยังไม่ได้เปิด job นี้ Automation ตั้งเวลาและการหมดอายุคำสั่งจะไม่ทำงานอัตโนมัติ**.

## 4. เชื่อม Frontend Home Thames

แก้ `config.js`:

```js
window.SMART_HOME_CONFIG = {
  SUPABASE_URL: 'https://YOUR_HOME THAMES_REF.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_XXXXXXXXXXXXXXXX'
};
```

อัปโหลดเว็บด้วย GitHub Desktop → GitHub Pages (workflow `.github/workflows/deploy.yml`). เปิด URL ผ่าน HTTPS, ไปที่ Supabase Auth → URL Configuration ใส่ Site URL และ Redirect URL ของเว็บไซต์ของคุณ. ตรวจ Email/Password Auth, Email confirmation, rate limit ตามการตั้งค่า Project. ทดสอบสมัคร/ล็อกอินและสร้างบ้านบนหน้าเว็บ.

ทดสอบว่าคลาวด์ออนไลน์โดยใช้ PowerShell:

```powershell
.\scripts\check-cloud.ps1 -ProjectRef YOUR_HOME THAMES_REF -PublishableKey "sb_publishable_..."
```

คำสั่งนี้ตรวจบริการ Auth เท่านั้น; **ไม่ได้พิสูจน์ว่า SQL และ Functions ติดตั้งครบ**.

## 5. เชื่อม ESP32-C6 + PZEM-004T

อ่าน `firmware/esp32c6-smarthome/README_TH.md` สำหรับการติดตั้งโปรแกรม. สรุป: เปิด Home Thames → เข้าระบบ → สร้างบ้าน → **เพิ่มอุปกรณ์** → เลือกมิเตอร์หลัก → รับรหัสอนุญาตติดตั้ง 48 ตัว → ใส่ในหน้า Wi-Fi Setup ของบอร์ดพร้อม Wi-Fi บ้าน → รอรหัสจับคู่ 16 ตัว → ยืนยันกลับในเว็บ.

ก่อน Flash ต้องสร้าง `firmware/esp32c6-smarthome/include/secrets.h` จากตัวอย่าง เติม URL, **Publishable Key เท่านั้น** และ CA Certificate จริงสำหรับ Supabase host. Wi-Fi บ้านถูกเก็บบน ESP32, ไม่ส่งรหัสผ่านไป Cloud. ไม่มีการฝัง secret ของ Supabase admin ในอุปกรณ์.

ชุด PZEM-004T สำหรับ **ไฟเมน 1 เฟส** และเฟิร์มแวร์นี้วัดอย่างเดียว ไม่มีการสั่งตัดไฟบ้าน. ต้องยืนยันชนิดระบบไฟที่ตู้เมนก่อนติดตั้ง ให้ช่างไฟฟ้าผู้มีคุณสมบัติเหมาะสมจัดการส่วนไฟบ้านและอุปกรณ์แยกสัญญาณ/ระบบป้องกันทั้งหมด.

## 6. ทดสอบรับค่าและตรวจสิทธิ์

- บ้าน A เพิ่มมิเตอร์หลักสำเร็จแล้วลองเพิ่มมิเตอร์หลักอีกตัว ต้องไม่ผ่าน
- สมาชิก `viewer` ต้องไม่สามารถออก Setup Ticket หรือสั่งสวิตช์
- รหัส Setup Ticket ที่ใช้แล้วต้องใช้ซ้ำไม่ได้ และใช้ผิดบ้านไม่ได้
- ถอด Wi-Fi บอร์ด → หน้าเว็บต้องแสดง Offline หลังเกินประมาณ 90 วินาที
- เครื่องส่งการอ่านซ้ำใน 60 วินาที → `energy_readings` ไม่ควรมีแถวซ้ำและค่าไฟไม่กระโดด
- ควบคุม Smart Switch **เฉพาะเมื่อใช้เฟิร์มแวร์/อุปกรณ์ที่ออกแบบสำหรับสวิตช์แล้ว** โค้ดมิเตอร์ไฟเมนห้ามใช้ขับรีเลย์
- หลังเปิด Cron ตรวจการส่งคำสั่ง Automation และสถานะ ACK/Failed
- ตั้งชื่อ/เลือกบ้านที่ต่างกัน และทดสอบว่าบ้าน A อ่านบ้าน B ไม่ได้

## 7. ขอบเขตและข้อควรระวัง

ระบบใช้ระบบจดทะเบียนอุปกรณ์ผ่าน Cloud ที่ต้องมี Setup Ticket ใหม่ ลดการสุ่มสมัครอุปกรณ์ได้มาก แต่ยังควรตั้ง quota/monitoring, backup, การป้องกัน brute-force และตรวจ Log สม่ำเสมอ. การรับค่าพลังงานและการคำนวณค่าไฟเป็น **ประมาณการ** ไม่ใช่มิเตอร์สำหรับการคิดเงินตามกฎหมายและไม่เท่ากับบิลทางการ. หากเน็ตหลุดยาวหรือ PZEM รีเซ็ตค่าพลังงาน อาจมีค่าคลาดเคลื่อน ให้ทดสอบกับมิเตอร์จริง.

**ยังไม่ถือว่าติดตั้ง Production สำเร็จ** จนกว่า Supabase Project, Cron, HTTPS, ESP32 firmware และการต่ออุปกรณ์จริงจะถูกตรวจสอบครบขั้นตอน. ทดสอบบนระบบไฟ DC แรงดันต่ำก่อนงานสวิตช์ทุกชนิด.
