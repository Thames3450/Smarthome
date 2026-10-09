# Home Thames — สถานะหลังบ้าน 8 ต.ค. 2569

Project: yosatolcfeafqpicnvyy / Organization: Thames3450's Org / Region: Singapore

ติดตั้งฐานข้อมูลเริ่มต้น (Schema และ RLS), Enrollment/Pairing/Meter RPC, Dashboard และกราฟย้อนหลังแล้ว
Edge Functions ที่ Deploy: device-register, claim-device, device-sync

**ยังไม่ทดสอบ ESP32 จริง / ยังไม่เปิด Scheduled Automations / ยังไม่ Deploy device-renew.**
การควบคุมอุปกรณ์ด้วย Smart Switch จริงยังต้องทำ Firmware และตรวจวงจรอย่างปลอดภัย

## เริ่มใช้เว็บ
1. เปิด index.html ผ่าน VS Code Live Server (ต้องมีอินเทอร์เน็ต)
2. ลงทะเบียนด้วยอีเมลและรหัสผ่านตามหน้าเว็บ แล้วตรวจอีเมลยืนยันหาก Supabase ขอให้ยืนยัน
3. เข้าสู่ระบบ สร้างบ้านและห้อง ตั้งอัตราค่าไฟ
4. ไปที่ เพิ่มอุปกรณ์ > มิเตอร์หลัก > ขอรหัสติดตั้ง
5. ก่อนใช้งาน ESP32 จริง ให้กรอก Supabase URL และ Publishable key ใน `firmware/esp32c6-smarthome/include/secrets.h` ตามตัวอย่าง โดยไม่ใส่ service_role
6. Flash Firmware และต่อ PZEM ผ่านอินเทอร์เฟซที่ปลอดภัย ผ่านการตรวจจากช่างไฟฟ้าก่อนต่อวงจรไฟบ้าน

การเปิดหน้าเว็บด้วย Live Server เป็นการใช้งานในเครือข่าย/คอมพิวเตอร์ที่รันเว็บ หากต้องการเข้าจากนอกบ้านต้อง Deploy เว็บไซต์ด้วย HTTPS เช่น GitHub Pages

## ข้อควรทราบ
- ค่า Demo ไม่ใช่ข้อมูลวัดจริง; เมื่อใช้ Cloud บัญชีใหม่จะยังไม่มีค่าไฟย้อนหลัง
- ยังไม่ได้เปิด Cron และ automation scheduler; อย่าคาดหวังการตั้งเวลาควบคุมอุปกรณ์จนกว่าจะติดตั้งและทดสอบเพิ่มเติม
- ห้ามเผยแพร่ Wi-Fi password, Device Token หรือ Supabase Service Role Key
- ไม่ต้องแก้ MPR Maintenance, IJ Maintenance หรือ Graden
