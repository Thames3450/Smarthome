# ผลทดสอบ Home Thames v2.5 (local source-only)

- `npm run check`: ผ่าน JavaScript syntax (6 ไฟล์)
- `npm test`: **35/35 ผ่าน** (รวม regression v2.4 และ guardrails v2.5)
- ทดสอบหน้าเว็บจำลองด้วย Chromium ที่ 1440 x 900 และ 390 x 844: กราฟและเลย์เอาต์ไม่ล้นแนวนอน ไม่มี `pageerror` ในการทดสอบที่สำเร็จ
- ทดสอบ Add Device แบบ Demo ด้วย Chromium: ขึ้น Setup Ticket, ปุ่มคัดลอก, คำแนะนำ Wi-Fi; ไม่มี `pageerror`
- ตรวจความเข้ากันได้ของ Cloud API ในระดับ source: `issue_enrollment_ticket`, `begin_device_enrollment`, `complete_device_claim`, `record_main_meter_sample` และ firmware `enrollment_ticket`

**ยังไม่ได้ทดสอบและไม่รับรอง:** การรัน SQL migration กับ Supabase Project ใหม่, การ Deploy Edge Functions, การเปิด Cron, การคอมไพล์ PlatformIO, การแฟลช ESP32-C6, การอ่านข้อมูล PZEM-004T จริง, หรือการต่อกับไฟบ้าน. ต้องทำการทดสอบเหล่านี้ใน Project/HW จริงก่อนใช้งาน Production.
