# อัปเดต Home Thames v2.4 → v2.5 (Backend)

1. สำรองไฟล์โปรเจกต์เดิมและสำรองฐานข้อมูล Supabase ก่อนทุกครั้ง
2. แตกไฟล์ ZIP ใหม่ แล้วคัดลอกทับทั้งโฟลเดอร์ **ยกเว้น `config.js` ที่กำหนด URL/Publishable Key ของคุณเอง** และห้ามลบ `firmware/.../include/secrets.h` ที่ใช้แฟลชบอร์ด
3. ตรวจ SQL migration 001–003 เคยรันหรือยัง; โปรเจกต์เดิมที่รันครบแล้วให้ใช้ `npx supabase db push` กับไฟล์ `004` ใหม่เท่านั้น (CLI จะเทียบประวัติ migrations อัตโนมัติ)
4. Deploy ฟังก์ชันใหม่ `device-register`, `device-sync`, `claim-device`, `device-renew` และ `run-automations` เพื่อให้ตรงกับ Schema 004
5. สร้าง `CRON_SECRET` และตั้ง Cron จาก `sql/cron_every_minute_TEMPLATE.sql` หากยังไม่ได้เปิด Automation
6. แฟลช Firmware v2.5 ใหม่; อุปกรณ์เดิมที่จับคู่ไว้แล้วใช้ ID/Token เดิมต่อได้หากยังไม่ Factory Reset. อุปกรณ์เดิมที่ยังไม่จับคู่ต้องลงทะเบียนใหม่ผ่าน **Setup Ticket 48 ตัว** (เพราะตารางจับคู่เก่ายังไม่มี authorized_home_id)
7. เปิดเว็บกด `Ctrl + Shift + R` และตรวจ `Application > Service Workers` หากค้างเวอร์ชันเดิม

ตรวจรายละเอียดเต็มที่ `DEPLOY_HOME THAMES_CLOUD_TH.md`

**คำเตือน:** ห้ามใช้ Home Thames Firmware ของมิเตอร์หลักสำหรับขับรีเลย์หรือสั่งตัดไฟบ้าน.
