import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * احراز هویت ساده‌ی پنل مدیریت برای یک کاربر (مدیر آرکان).
 * کوکی نشست یک توکن HMAC است که بدون کلید سرور قابل جعل نیست.
 * بدون افزودن کتابخانه‌ی سنگین احراز هویت.
 */

export const ADMIN_COOKIE = "arkan_admin";

// کلید امضای نشست؛ اگر تنظیم نشده باشد از رمز ادمین مشتق می‌شود.
function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "arkan-insecure-dev-secret"
  );
}

export function makeSessionToken(): string {
  return crypto
    .createHmac("sha256", secret())
    .update("arkan-admin-session-v1")
    .digest("hex");
}

export function isValidSession(value?: string): boolean {
  if (!value) return false;
  const expected = makeSessionToken();
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** آیا درخواست فعلی نشست معتبر مدیر دارد؟ (سمت سرور) */
export function isAuthed(): boolean {
  const value = cookies().get(ADMIN_COOKIE)?.value;
  return isValidSession(value);
}
