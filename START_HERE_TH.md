# Home Thames v2.5 เริ่มต้นใช้งาน

**ก่อนเปิด Cloud จริง** ให้อ่าน `DEPLOY_HOME THAMES_CLOUD_TH.md` และลง migration 001–004 ตามลำดับ ติดตั้ง ESP32 ต้องใช้ Setup Ticket 48 ตัวจากหน้าเว็บก่อนรับ Pairing Code.

---

# เริ่มต้น Home Thames v2.3

เปิด `index.html` ด้วย Live Server บน VS Code แล้วตรวจดูเมนูและไอคอน Streamline

**มีอุปกรณ์แสดงขึ้นแต่ไม่มีไอคอน?** ลองกด Ctrl+Shift+R; หากยังไม่หายให้อ่าน `UPGRADE_v2_3_TH.md` (อาจเป็น Service Worker เก่า)

**มี Supabase เดิมอยู่?** สำรองและคง `config.js` เดิมไว้ ไม่ต้องแก้ไขฐานข้อมูล/ESP32 เพื่ออัปเดตไอคอน
