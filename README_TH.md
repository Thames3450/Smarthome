# Home Thames React v4.1 — Light / Dark Mode

> เพิ่มปุ่มสลับธีมทั้งเว็บและจำค่าไว้ในเบราว์เซอร์ ดูคู่มือ `DUAL_THEME_v4_1_TH.md`

# Home Thames React + TypeScript v4.0

โปรเจกต์นี้เป็น **React + TypeScript + Vite** (ไม่ใช่เว็บ HTML/JS แบบเดิมที่เปิด `index.html` โดยตรง)

## เริ่มใช้งานผ่าน Terminal (Windows / VS Code)

**ต้องติดตั้ง Node.js 20.19+ หรือ 22.12+** และมี npm มากับ Node.js

1. แตก ZIP และเปิดโฟลเดอร์ `HomeThames_React_TypeScript_v4_0` ใน VS Code
2. เปิด Terminal → New Terminal แล้วรัน

```powershell
npm install
npm run dev
```

3. เปิดลิงก์ที่ Vite แสดง เช่น `http://localhost:5173/`
4. ต้อง `npm run dev` ขณะพัฒนา และใช้ `npm run build` เพื่อสร้าง `dist/` สำหรับเผยแพร่

**หมายเหตุสำคัญ** React สำหรับเว็บยังมี `index.html` เป็นจุดเริ่มต้น และ browser ยังต้องใช้ JavaScript/CSS ที่ Vite สร้างให้ แต่ซอร์สหน้าจอและตรรกะอยู่ในไฟล์ React **`.tsx` / `.ts`** ไม่ใช่การต่อ HTML/CSS/JavaScript แบบเดิม

## ตั้งค่า Supabase

ไฟล์ `.env` มี **Project URL + publishable key** ของ Home Thames (ไม่ใช่ Service Role Key) ตรงกับระบบก่อนหน้านี้แล้ว หากเปลี่ยนโปรเจกต์ ให้เปลี่ยนค่าใน `.env` แล้วเริ่ม dev server ใหม่:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

ระบบ login ใช้ Supabase Auth และเก็บ session ใน sessionStorage ตามเว็บเดิม ดังนั้น localhost เป็นคนละ Origin กับ GitHub Pages อาจต้องเข้าสู่ระบบใหม่อีกครั้ง

## คุณสมบัติที่นำมาจากเว็บเดิม

- React Components: ภาพรวม, อุปกรณ์, พลังงาน, ห้อง, ระบบอัตโนมัติ, สมาชิก, การแจ้งเตือน, ตั้งค่า, รายละเอียดอุปกรณ์
- Supabase Home Thames REST + Auth + RLS เดิม ไม่สร้างตารางใหม่ และไม่มีคีย์ Service Role ในเว็บ
- เพิ่มอุปกรณ์: สร้าง Enrollment Ticket → กรอกใน ESP32 Captive Portal → Pair Code → Confirm บนเว็บ
- กราฟข้อมูลพลังงานจาก RPC `home_energy_series` และสรุปจาก `home_dashboard` จริง
- ปุ่มสวิตช์ออกคำสั่งผ่าน `device_commands` เฉพาะ Smart Switch ที่ออนไลน์และมีสิทธิ์ ไม่ควบคุมมิเตอร์ไฟเมน
- Multi-home และสิทธิ์สมาชิกตาม `home_members`
- Light Modern Responsive / Sarabun
- ไฟล์ PNG Streamline Ultimate Regular ทั้ง **54 ไฟล์** (`public/icons/`) ใช้กับ Components ต่าง ๆ รวมถึงมีเมนู Settings → คลังไอคอน
- โหมดทดลองแยกจาก Cloud จริง (จะไม่สร้างข้อมูลปลอมใน Cloud)

## Build / Preview

```powershell
npm run build
npm run preview
```

Vite จะสร้างไฟล์เว็บเผยแพร่ไว้ใน `dist/` อย่าเปิด `index.html` โดยตรง ให้เปิดผ่าน `npm run dev` หรือ `npm run preview`

## Deploy GitHub Pages

1. แก้ Workflow `.github/workflows/deploy.yml` ให้ Repository เปิด GitHub Pages → Source = GitHub Actions
2. Workflow คำนวณ base path ให้ตรงกับชื่อ Repository และ build ผ่าน Vite โดยอัตโนมัติ
3. Push โค้ดไป GitHub เพื่อให้ Workflow ทำงาน
4. อย่าอัปโหลด `node_modules` และอย่าใส่ Service Role Key ใน `.env`

## โครงสร้างสำคัญ

- `src/App.tsx` – หน้าเว็บ React และ workflow การใช้งาน
- `src/components/Icon.tsx` – แสดง PNG 48x48 ของ Streamline
- `src/api/cloud.ts` – client REST/Auth เดิมของ Home Thames ย้ายเป็น TypeScript
- `src/api/demo.ts` – ข้อมูลทดลองแยกต่างหาก
- `src/lib/energy.ts` – date/period helper เดิม
- `src/styles.css` – สไตล์ Light Theme responsive
- `public/icons/` – ไอคอนทั้งหมด 54 ไฟล์
- `supabase/`, `firmware/` – โค้ด backend และ ESP32 จากโครงการเดิมสำหรับอ้างอิง/ปรับปรุงต่อ ไม่เกี่ยวกับคำสั่ง npm

## ข้อจำกัดการตรวจสอบ

- ตรวจไวยากรณ์ TypeScript/TSX ได้ แต่เครื่องมือทดสอบปัจจุบัน **ไม่สามารถดาวน์โหลด npm dependencies** จึงยังไม่ได้ยืนยันการ Build/รันจริงด้วย `npm run build`
- ระบบ Cloud ใช้ฐานข้อมูลและ Edge Functions Home Thames เดิม การต่ออุปกรณ์จริงต้องทดสอบด้วยบัญชีที่มีสิทธิ์และฮาร์ดแวร์จริง
- หากพบข้อผิดพลาดใน Terminal ให้ส่งข้อความ Error มาเพื่อตรวจสอบ
