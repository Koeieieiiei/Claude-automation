"use client";

import { useEffect, useState } from "react";
import { GoogleLogo } from "./GoogleButton";

export interface ClientUser {
  email: string;
  name: string;
  picture: string;
}

/** ถามสถานะล็อกอินจาก server (คุกกี้เป็น httpOnly — JS อ่านเองไม่ได้) */
export async function fetchCurrentUser(): Promise<ClientUser | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: ClientUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * ปุ่มบัญชีบนแถบหัวเว็บ: ยังไม่ล็อกอิน → "เข้าสู่ระบบ" · ล็อกอินแล้ว → "คอร์สของฉัน"
 * user: undefined = ให้ปุ่มถาม server เอง · null/ClientUser = หน้าที่ใช้รู้สถานะอยู่แล้ว
 */
export default function AccountButton({
  user: userProp,
  next = "/my-courses",
}: {
  user?: ClientUser | null;
  next?: string;
}) {
  const [fetched, setFetched] = useState<ClientUser | null | undefined>(undefined);
  const user = userProp !== undefined ? userProp : fetched;

  useEffect(() => {
    if (userProp !== undefined) return;
    fetchCurrentUser().then(setFetched);
  }, [userProp]);

  if (user === undefined) {
    return <span className="inline-block h-8 w-24" aria-hidden />; // กันปุ่มกระโดดตอนโหลด
  }

  if (!user) {
    return (
      <a
        href={`/api/auth/google?next=${encodeURIComponent(next)}`}
        className="inline-flex items-center gap-2 whitespace-nowrap border border-ink/25 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-ink"
      >
        <GoogleLogo className="h-4 w-4" />
        เข้าสู่ระบบ
      </a>
    );
  }

  return (
    <a
      href="/my-courses"
      className="inline-flex items-center gap-2 whitespace-nowrap border border-ink/25 bg-white py-1 pl-1 pr-3 text-sm font-semibold text-ink transition hover:border-maroon hover:text-maroon"
      title={user.email}
    >
      <Avatar user={user} />
      คอร์สของฉัน
    </a>
  );
}

export function Avatar({ user, size = "h-6 w-6" }: { user: ClientUser; size?: string }) {
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();
  if (user.picture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.picture}
        alt=""
        referrerPolicy="no-referrer"
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-maroon text-xs font-bold text-paper`}>
      {initial}
    </span>
  );
}
