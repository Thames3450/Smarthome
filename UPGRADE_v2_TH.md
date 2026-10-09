# การอัปเดต Home Thames v1.1 → v2.0

1. **สำรองโฟลเดอร์ v1.1 เดิม** ก่อนทำการเปลี่ยนแปลง
2. แตก ZIP ใหม่ โดยใช้โฟลเดอร์ `Home Thames_Smart_Home_Cloud` ภายใน ZIP
3. หากเคยตั้งค่า Supabase แล้ว ให้สำรองและนำ **config.js** เดิมมาใช้ต่อหลังแตกไฟล์ใหม่ โดยอย่าเผยแพร่ค่า Service Role Key
4. หากเคยมี `firmware/esp32c6-smarthome/include/secrets.h` ให้เก็บไฟล์ส่วนตัวไว้ และทบทวน CA certificate ก่อนแฟลช Firmware ใหม่
5. โครงสร้างฐานข้อมูลใน v2.0 ใช้ **SQL ของ v1.1 เดิม** ไม่มี Migration ใหม่ หากเคยติดตั้งครบแล้ว **ไม่ต้องรัน initial migrations ซ้ำ**
6. เปิด `index.html` ผ่าน VS Code Live Server แล้วกด `Ctrl + Shift + R` เพื่อโหลดไฟล์ CSS/JS ใหม่ หาก PWA แคชไฟล์เก่าให้ปิดเปิดใหม่
7. ปุ่ม Add Device เปลี่ยนเป็น Wizard: เลือกชนิด > เชื่อม Wi-Fi ESP32 > ตั้ง Wi-Fi บ้านผ่าน portal > ใส่ pairing code > ตั้งชื่อ
8. Firmware Main Meter รุ่น v2 เพิ่ม `/networks` เพื่อให้ Local Setup Portal สแกน Wi-Fi และเลือก SSID บ้านได้

**สำคัญ:** รุ่นปัจจุบันยังไม่ได้ยืนยันการใช้งานกับบอร์ดจริงหรือระบบไฟ AC โปรดทดสอบฮาร์ดแวร์และความปลอดภัยก่อนติดตั้งในตู้เมน
