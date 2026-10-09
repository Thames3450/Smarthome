# Home Thames Smart Home Cloud v2.5 — Secure Backend

**ต่อยอดจาก v2.4** คงหน้าเว็บไทย + Sarabun + Streamline icons + ประวัติไฟ วัน/สัปดาห์/เดือน/ปี + มิเตอร์หลักหนึ่งตัวต่อบ้าน.

## เพิ่มเติมใน v2.5

- Home Owner / Admin ออก **รหัสติดตั้ง 48 อักขระ** ครั้งเดียว อายุ 15 นาที; Firmware นำรหัสไปยืนยันกับ `device-register`
- หลังบ้านผูกการลงทะเบียนกับบ้านและชนิดอุปกรณ์ที่ออก Setup Ticket; `claim-device` ต้องจับคู่กับบ้านที่ถูกต้อง
- Token ฝั่ง ESP32 แต่ละตัวแยกกันและเก็บเฉพาะ SHA256 ในฐานข้อมูล; ถอนสิทธิ์ด้วยการลบอุปกรณ์
- `record_main_meter_sample` ใช้ transaction lock + 60s spacing + zero delta ในกรณีมิเตอร์ reset เพื่อป้องกันบิลกระโดด/นับซ้ำ
- SQL Migration v2.5, ตัวอย่าง Cron/Vault, PowerShell cloud check และคู่มือ Deploy ภาษาไทย
- ESP32 เก็บสถานะ Pairing ไว้ใน NVS; มีคำสั่ง `RESET` ทาง Serial เพื่อ Reset ด้วยการเข้าถึงตัวบอร์ดจริง

อ่าน **`DEPLOY_HOME THAMES_CLOUD_TH.md`** เพื่อติดตั้งจริง; อย่านำ v2.5 ไปวางทับฐานข้อมูล IJ/MPR.

## สถานะระบบ

**โค้ดพร้อมนำไป Deploy** แต่ยังไม่ได้ถูกติดตั้งใน Supabase Project ของคุณ และยังไม่ได้ทดสอบสัญญาณจาก PZEM/ไฟเมนจริง. การสร้าง Project และเปิด Scheduler เป็นขั้นตอนที่ต้องทำก่อนใช้งานจากนอกบ้าน.
