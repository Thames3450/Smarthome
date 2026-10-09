# Home Thames v2.5 — Secure Cloud Backend

**เริ่มที่ `README_v2_5_TH.md` และ `DEPLOY_HOME THAMES_CLOUD_TH.md` ก่อน** คู่มือด้านล่างเป็นเนื้อหา v2.4 ซึ่งใช้ API จับคู่รูปแบบเก่า จึงไม่ใช่ลำดับติดตั้งที่ใช้กับ v2.5 ทั้งหมด.

---

# Home Thames Smart Home v2.3 — ไอคอนแสดงผลได้แม้ไฟล์ assets หาย

เริ่มต้นที่ **UPGRADE_v2_3_TH.md** สำหรับขั้นตอนแก้ไอคอนไม่ขึ้นโดยไม่กระทบ Cloud เดิม

# Home Thames Smart Home Cloud v2.2 · Streamline Icons

เว็บ Home Thames ภาษาไทย ธีมสว่าง และชุดไอคอน Streamline Ultimate Regular 48×48 PNG จากไฟล์ของคุณ

- นำเข้าไอคอน PNG ครบ 54 ภาพ ใน `assets/icons/`
- แมปไอคอนเข้ากับเมนูและการ์ดที่มีรูปตรงความหมาย 28 ประเภท ผ่าน `src/icons.js`
- ใช้ PNG เป็น CSS mask เพื่อให้ไอคอนเป็นสีตามธีม Home Thames (ฟ้า ม่วง เขียว ส้ม)
- รองรับเว็บไซต์บนเดสก์ท็อปและมือถือ รวมถึง PWA; อัปเดต cache และ GitHub Pages ให้คัดลอก `assets` ด้วย
- ระบบ Supabase, ระบบจับคู่ ESP32, การวัดไฟเมน 1 จุด/บ้าน และ Firmware เดิมไม่ถูกเปลี่ยน

**เริ่มต้น:** อ่าน `START_HERE_TH.md` และ `UPGRADE_v2_2_TH.md`

> ไอคอนที่นำเข้าเป็นไฟล์ที่คุณส่งมา โปรดปฏิบัติตามเงื่อนไขสิทธิ์ใช้งานของชุด Streamline ที่คุณมี


## v2.4 · Thai Energy History

เลือกกราฟรายวัน/รายสัปดาห์/รายเดือน/รายปี และเลือกเดือนค่าไฟย้อนหลังได้ หน้ารายละเอียดมิเตอร์ไม่แสดงแกนเวลาอัดติดกัน ฟอนต์หลักเป็น Sarabun ผ่าน Google Fonts. อ่านวิธีติดตั้ง SQL เพิ่มเติมใน `UPGRADE_v2_4_TH.md`.
