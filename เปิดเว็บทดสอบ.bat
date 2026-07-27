@echo off
chcp 65001 >nul
title เว็บทดสอบ Mock TPAT3 - อย่าปิดหน้าต่างนี้
cd /d "%~dp0"

echo.
echo  ================================================
echo    กำลังเปิดเว็บทดสอบ Mock TPAT3 ...
echo  ================================================
echo.

REM ใช้ DOWNLOAD_SECRET คงที่จากไฟล์ .env.local — ห้ามสุ่มใหม่ทุกครั้งที่เปิด
REM (ถ้าสุ่มใหม่ ลิงก์/สิทธิ์เข้าห้องสอบที่ออกไปก่อนหน้าจะใช้ไม่ได้ทันทีที่รีสตาร์ท)
set EXAM_DEMO=1

REM ถ้ายังไม่ได้ build ให้ build ก่อน (ครั้งแรกใช้เวลาสักครู่)
if not exist ".next\BUILD_ID" (
  echo  [1/2] กำลังเตรียมไฟล์เว็บ รอสักครู่...
  call npm run build
)

echo.
echo  เปิดเบราว์เซอร์ให้อัตโนมัติแล้ว ถ้าไม่ขึ้นให้พิมพ์เอง:
echo.
echo     ในคอมเครื่องนี้ :  http://localhost:3000
echo     ในมือถือ/iPad   :  ดูที่บรรทัด "Network:" ที่ขึ้นด้านล่าง (ต้องต่อ Wi-Fi วงเดียวกัน)
echo.
echo  * ปิดหน้าต่างนี้ = เว็บทดสอบดับ
echo.

start "" http://localhost:3000
npx next start -H 0.0.0.0 -p 3000
pause
