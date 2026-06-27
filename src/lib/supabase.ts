import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * کلاینت Supabase فقط برای سمت سرور.
 * از SERVICE_ROLE استفاده می‌کند (هرگز به کلاینت ارسال نمی‌شود) تا درج در جدول leads
 * بدون نیاز به باز کردن RLS عمومی انجام شود.
 *
 * اگر متغیرهای محیطی تنظیم نشده باشند، null برمی‌گرداند و سرور‌اکشن به فالبک
 * (لاگ سرور) سوییچ می‌کند تا توسعه قطع نشود.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
