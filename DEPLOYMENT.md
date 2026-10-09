# การ Deploy Home Thames v2.5

**โปรดใช้คู่มือ `DEPLOY_HOME THAMES_CLOUD_TH.md` เป็นหลัก** (เพิ่ม Setup Ticket 48 ตัว และ Migration 004) เพราะรายละเอียดบางช่วงด้านล่างเป็นคู่มือเก่าและไม่รองรับระบบลงทะเบียนใหม่.

---

# คู่มือ Deploy Smart Home Cloud (ภาษาไทย)

## A. เปิดเว็บ Demo ก่อน

ใช้ `python -m http.server 8080` ในโฟลเดอร์โปรเจกต์ → `http://localhost:8080` เว็บจะเข้า Demo Mode ถ้า `config.js` ยังไม่มี URL และ Public Key

## B. สร้าง Supabase Project

1. สร้าง Supabase Project ใหม่ แยกจากระบบ IJ/MPR เดิม เพื่อไม่ให้ข้อมูลโครงการเดิมปะปนกัน
2. จด **Project URL** และ **Publishable key / anon key** (สองค่านี้ใช้ในเว็บไซต์ได้)
3. เก็บ **Service role key** เป็น secret เฉพาะฝั่ง Supabase Edge Function อย่านำไปวางใน config.js หรือ ESP32
4. ตั้ง Authentication → URL Configuration → Site URL เป็น URL ที่จะเปิดจริง เช่น GitHub Pages และเพิ่ม Redirect URLs ให้ตรง
5. ตั้ง Email/Password Auth และนโยบาย Verify Email ตามต้องการ; เปิด Rate Limit / CAPTCHA ตามบริการที่ใช้

### ฐานข้อมูล

ใช้ Supabase CLI ที่ติดตั้งแล้ว (หรือ SQL Editor หากเริ่มต้นด้วย migration เดียว):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

อีกทางเลือกคือคัดลอก **เนื้อหาเต็มไฟล์** `supabase/migrations/202610080001_initial.sql` ลง SQL Editor ในโปรเจกต์ใหม่ รันครั้งเดียวบนฐานข้อมูลใหม่เท่านั้น อย่ารัน migration ซ้ำโดยไม่ตรวจสอบ

SQL สร้าง Homes, Members, Rooms, Devices, Credentials, Pairings, Readings, Commands, Automation, Invites, Notifications และ Policies/RPC ทั้งหมด

### Deploy Edge Functions

```bash
supabase functions deploy device-register
supabase functions deploy device-renew
supabase functions deploy claim-device
supabase functions deploy device-sync
supabase functions deploy run-automations
```

`supabase/config.toml` ตั้ง `verify_jwt=false` เฉพาะ function endpoints เพราะ `device-register`/`device-sync` ใช้ Device Token ของ ESP32, `claim-device` ตรวจ Supabase User JWT ด้วย `getUser()`, `run-automations` ตรวจ `x-cron-secret` ส่วน Credentials ของอุปกรณ์เก็บ SHA-256 hash เท่านั้น

ตั้งค่า CRON_SECRET เป็นค่าสุ่มความยาวอย่างน้อย 32 ตัวอักษร **อย่าใส่ลง source / เว็บ**:

```bash
supabase secrets set CRON_SECRET="YOUR_RANDOM_LONG_SECRET"
```

สร้าง Scheduled Job ให้เรียก `POST https://PROJECT_REF.supabase.co/functions/v1/run-automations` **ทุก 1 นาที** พร้อม Header `x-cron-secret: <ค่าที่เก็บใน Secret Manager>` เช่นใช้ pg_cron + pg_net กับ Supabase Vault หรือ scheduler ภายนอกที่เก็บ secret ปลอดภัย ขณะไม่มี Cron การตั้งเวลา/แจ้งเตือน Automation จะยังไม่ทำงาน

### นโยบายระบบ Cloud

- ESP32 `device-sync` ส่งสถานะทุก 10 วินาที (online ภายใน 90 วินาที) และบันทึกข้อมูล Energy Readings ประมาณทุก 60 วินาที
- Edge API รับ **X-Device-Token** ต่ออุปกรณ์ที่มีสิทธิ์เท่านั้น อุปกรณ์ใช้ HTTPS ที่ตรวจสอบ CA จริง
- `device-register` เปิดสาธารณะเพื่อ provisioning: ก่อนใช้จริงต้องตั้ง **WAF/IP rate limit** / quotas, ตรวจการโจมตี enrollment, และตั้งงาน cleanup เครื่องที่ไม่ได้จับคู่
- เรียก `run-automations` โดยใช้ scheduler ที่เก็บ Secret ฝั่ง Server เท่านั้น
- แนะนำเปิด Log/Monitoring, backups, log retention และ Device Token rotation สำหรับ production
- บิลใช้ `homes.billing_meter_id`; ถ้ายังไม่เลือก ระบบอ้างอิง energy meter ตัวแรก (หรือ energy_switch ตัวแรก)

## C. ต่อหน้าเว็บจริง

แก้ไฟล์ `config.js`:

```javascript
window.SMART_HOME_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_PUBLISHABLE_OR_ANON_KEY'
};
```

**ข้อสังเกต:** การใส่ Public Key ใน Frontend เป็นรูปแบบที่รองรับของ Supabase แต่ Service Role Key ห้ามใส่เด็ดขาด และต้องมี RLS ตาม Migration ด้วย

เปิดเว็บใหม่ → Sign Up → ยืนยัน Email หากกำหนดไว้ → Create Home → Create Room

## D. เผยแพร่ GitHub Pages

1. สร้าง repository ใหม่ ไม่ใช้ repository IJ/MPR ที่ทำงานอยู่
2. คัดลอกโฟลเดอร์โปรเจกต์ขึ้น repo ด้วย GitHub Desktop
3. ตั้ง `Settings → Pages → Build and deployment → GitHub Actions`
4. Push branch `main` → workflow `Verify & Deploy Home Thames` จะรัน tests แล้ว deploy static site
5. เมื่อเว็บอยู่บน HTTPS ให้ตรวจ Auth Site URL และ Refresh URLs ใน Supabase
6. `manifest.webmanifest` ช่วยเพิ่มเว็บลงหน้าจอ Home Screen ของ iOS/Android ได้เมื่อเปิดผ่าน HTTPS

เว็บ PWA เป็น Static App ที่คุยกับ Supabase Cloud โดยตรงผ่าน User JWT มี RLS, ส่วน Device ใช้ HTTPS Edge Function ไม่จำเป็นต้องเปิด port router

## E. Flash ESP32-C6 + PZEM-004T

1. เปิดโฟลเดอร์ `firmware/esp32c6-smarthome/` ใน VS Code + PlatformIO
2. คัดลอก `include/secrets.example.h` → `include/secrets.h`
3. ใส่ `CLOUD_BASE_URL` ของ Supabase และ **Root CA PEM จริง** ที่ตรวจสอบสายรับรองของโดเมนนั้นได้
4. ตรวจสอบ GPIO4/GPIO5 และ Pinout ของ ESP32-C6-Zero กับอุปกรณ์ที่คุณซื้อจริงก่อนต่อวงจร
5. ตรวจการจ่ายไฟ PZEM, การแยกวงจร และ UART logic-level ที่ 3.3V ก่อนเสียบ ESP32/USB
6. Upload, เปิด Serial Monitor 115200, ดู `HomeThames-Setup-XXXX` พร้อม Password ที่สร้างแบบสุ่ม
7. ใช้โทรศัพท์เชื่อม Wi-Fi ชั่วคราว เปิด `http://192.168.4.1` แล้วกรอก Home Wi-Fi 2.4GHz
8. เมื่อ ESP32 เชื่อม Cloud ได้ ให้ดู Pairing Code บนหน้า Setup/Serial Monitor
9. เข้า Home Thames → My Devices → Add Device → กรอก Code 16 ตัว → เลือกห้อง → Pair
10. ESP32 ส่ง `device-sync` → เว็บ Online ใน 10–30 วินาที

**หมายเหตุ:** PlatformIO Espressif32 upstream บางเวอร์ชันยังไม่รองรับ Arduino บน ESP32-C6 โปรเจกต์ใช้ PIOArduino เพื่อรองรับเวอร์ชันปัจจุบัน ตรวจสอบ toolchain/board ที่ติดตั้งก่อนแฟลช (หากไม่สามารถคอมไพล์ให้ลอง Arduino IDE ด้วย ESP32 Arduino core 3.x)

### พอร์ต / Pin (เฉพาะสัญญาณแรงดันต่ำ)

| อุปกรณ์ | ESP32-C6-Zero | หมายเหตุ |
|---|---|---|
| PZEM TX | GPIO4 (RX) | ผ่านอินเทอร์เฟซที่ตรวจสอบฉนวนและระดับสัญญาณ |
| PZEM RX | GPIO5 (TX) | ผ่านอินเทอร์เฟซที่เหมาะสม |
| GND / Vcc | ตาม datasheet | ต้องตรวจสอบ isolation ของวงจรจริง ไม่ผูกกราวด์ไฟบ้านเข้า USB |
| Optional Relay Driver | GPIO7 (default disabled) | ต่อกับ **driver isolated ที่อนุมัติแล้ว** ห้ามต่อไฟ AC ตรง GPIO |

**ห้ามใช้บอร์ดไข่ปลาเพื่อเดินสายไฟ AC 220V**; การติดตั้งจริงต้องมีวงจรป้องกัน กล่องปิดมิดชิด ฟิวส์ / เบรกเกอร์ / การแยกวงจร โดยผู้ชำนาญงานไฟฟ้า

## F. ทดสอบการควบคุม

Firmware ค่าเริ่มต้น `ENABLE_RELAY_OUTPUT 0` = **Energy Monitor Only** การกดควบคุมจะไม่ปรากฏเพราะอุปกรณ์ไม่มี capability Smart Switch

สำหรับการทดสอบสวิตช์ ให้เริ่มจากวงจร **DC แรงดันต่ำที่ปลอดภัย** และอุปกรณ์ขับสัญญาณที่มีฉนวนอย่างถูกต้อง ทดสอบผลลัพธ์ ON/OFF, ACK, timeout และกรณี Wi-Fi หลุดก่อนจึงค่อยวางแผนการติดตั้งไฟบ้านด้วยช่างไฟฟ้า

## G. ขอบเขตที่ยังต้องพัฒนาก่อนใช้งานระดับ Production

- WAF/IP throttling บน Provisioning API, rate limiting และ anti-enrollment-abuse
- Formal transaction/logging for automation commands and concurrency stress test
- OTA update + device secret rotation/revocation flows + encrypted flash storage
- Daily/Monthly aggregation (สำหรับการเก็บข้อมูลหลายปีและโหลดสูง)
- การคำนวณอัตราการไฟฟ้าขั้นบันได/ค่า Ft/VAT และ Billing Cycle ที่ตรงกับบิลจริง
- Circuit-level safety interlocks, command authority, physical emergency control และอุปกรณ์ควบคุม AC ที่ได้รับการตรวจโดยช่างไฟฟ้า

### Upgrade v1.0 → v1.1 (Light Minimal / Main Meter Only)

- สำรอง Supabase ก่อนรัน migration ใหม่ `supabase/migrations/202610080002_one_main_meter.sql`
- ตรวจหามิเตอร์ซ้ำด้วยคำสั่ง PRE-CHECK ที่อยู่ในหัว migration และจัดการเครื่องซ้ำก่อน upgrade
- Migration ป้องกันการจับคู่ Main Meter ซ้ำและไม่อนุญาตให้ energy_meter ใช้ output relay
- การเพิ่ม Smart Switch ใช้ device `kind=smart_switch` และ Firmware สำหรับ Smart Switch แยกต่างหาก; ไม่ใช้บอร์ดวัดไฟตู้เมนเป็นวงจรสั่งตัดไฟเมน
- วัดที่ตู้เมนไฟฟ้าเฟสเดียว; สำหรับ 3 เฟสต้องออกแบบ hardware ใหม่ตามพิกัด
