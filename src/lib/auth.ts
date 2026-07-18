import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * احراز هویت پنل مدیریت — چندکاربره با نقش‌ها (فاز CRM).
 * کوکی نشست: base64url(JSON{uid,email,role,exp}) + "." + امضای HMAC.
 * سازگاری با عقب: توکن تک‌کاربره‌ی قدیمی هم پذیرفته می‌شود (نشست owner)
 * تا مدیر فعلی با استقرار نسخه‌ی جدید از پنل بیرون نیفتد.
 */

import { ROLES, ROLE_RANK, type Role } from "@/lib/roles";

export { ROLES, ROLE_RANK, ROLE_LABELS, type Role } from "@/lib/roles";

export const ADMIN_COOKIE = "arkan_admin";

export type AdminSession = {
  uid: string; // uuid ردیف admin_users یا "legacy"
  email: string;
  role: Role;
  exp: number; // epoch seconds
};

// کلید امضای نشست؛ اگر تنظیم نشده باشد از رمز ادمین مشتق می‌شود.
function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "arkan-insecure-dev-secret"
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

/** توکن تک‌کاربره‌ی نسخه‌ی قبل — فقط برای سازگاری با نشست‌های موجود (عمداً export نمی‌شود). */
function makeSessionToken(): string {
  return crypto
    .createHmac("sha256", secret())
    .update("arkan-admin-session-v1")
    .digest("hex");
}

/** ساخت توکن نشست برای یک کاربر ادمین (۳۰ روز اعتبار). */
export function createSessionToken(user: {
  id: string;
  email: string;
  role: Role;
}): string {
  const session: AdminSession = {
    uid: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(value?: string): AdminSession | null {
  if (!value) return null;

  // سازگاری با توکن قدیمی (تک‌کاربره) ⇒ نشست owner
  const legacy = makeSessionToken();
  if (value.length === legacy.length) {
    const a = Buffer.from(value);
    const b = Buffer.from(legacy);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { uid: "legacy", email: "legacy-admin", role: "owner", exp: 0 };
    }
  }

  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as AdminSession;
    if (!session.uid || !ROLES.includes(session.role)) return null;
    if (session.exp && session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

/** نشست معتبر درخواست فعلی (سمت سرور) یا null. */
export function getSession(): AdminSession | null {
  const value = cookies().get(ADMIN_COOKIE)?.value;
  return parseSessionToken(value);
}

/** آیا درخواست فعلی نشست معتبر مدیر دارد؟ (سمت سرور) */
export function isAuthed(): boolean {
  return getSession() !== null;
}

/** آیا نقش نشست حداقل به اندازه‌ی نقش خواسته‌شده قدرت دارد؟ */
export function hasRole(session: AdminSession | null, min: Role): boolean {
  if (!session) return false;
  return ROLE_RANK[session.role] >= ROLE_RANK[min];
}

/** آیا کاربر اجازه‌ی تغییر داده دارد؟ (viewer فقط‌خواندنی است) */
export function canWrite(session: AdminSession | null): boolean {
  return hasRole(session, "operator");
}
