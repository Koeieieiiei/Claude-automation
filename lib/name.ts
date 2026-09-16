/** แยกชื่อเต็มจาก Google เป็นชื่อ + นามสกุล (ใช้ได้ทั้ง client และ server) */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
