/**
 * ตรวจว่าเปิดเว็บจาก "เบราว์เซอร์ในแอป" (TikTok, Instagram, Facebook, LINE ฯลฯ) หรือไม่
 *
 * Google บล็อกการล็อกอินจากเบราว์เซอร์ในแอป (ขึ้น "Error 403: disallowed_useragent")
 * ร้านนี้คนเข้าจาก TikTok เยอะ → ต้องพาไปเปิดใน Chrome/Safari ก่อนเริ่มล็อกอิน
 * คืนชื่อแอป (ไว้โชว์ในข้อความ) หรือ null ถ้าเป็นเบราว์เซอร์ปกติ
 * import ได้ทั้ง client และ server
 */
export function detectInAppBrowser(ua: string | null | undefined): string | null {
  const s = ua ?? "";
  if (/musical_ly|BytedanceWebview|TikTok|trill_|aweme/i.test(s)) return "TikTok";
  if (/Instagram/i.test(s)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/i.test(s)) return "Facebook";
  if (/\bLine\//i.test(s)) return "LINE";
  if (/Twitter/i.test(s)) return "X";
  // Android WebView ทั่วไป (แอปอื่น ๆ ที่ฝังเว็บ) — มีคำว่า "; wv)" ใน user agent
  if (/Android.*;\s*wv\)/i.test(s)) return "แอป";
  return null;
}
