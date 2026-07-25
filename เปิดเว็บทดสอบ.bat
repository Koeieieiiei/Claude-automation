@echo off
chcp 65001 >nul
title เว็บทดสอบ Mock TPAT3 - อย่าปิดหน้าต่างนี้
cd /d "%~dp0"

echo.
echo  ================================================
echo    กำลังเปิดเว็บทดสอบ Mock TPAT3 ...
echo  ================================================
echo.

REM กุญแจสุ่มใหม่ทุกครั้ง ใช้เฉพาะเครื่องนี้ ไม่เกี่ยวกับเว็บจริง
for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set DOWNLOAD_SECRET=%%i
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
echo     ในมือถือ/iPad   :  http://172.20.10.4:3000   (ต้องต่อ Wi-Fi วงเดียวกัน)
echo.
echo  * ปิดหน้าต่างนี้ = เว็บทดสอบดับ
echo.

start "" http://localhost:3000
npx next start -H 0.0.0.0 -p 3000
pause
