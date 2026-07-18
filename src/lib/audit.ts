import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AdminSession } from "@/lib/auth";
import type { AuditAction } from "@/lib/audit-actions";

/**
 * ثبت رد عملیات مدیران در audit_log.
 * حتماً await شود: در محیط serverless (Vercel) بعد از ارسال پاسخ، درخواست‌های
 * معلق ممکن است هرگز کامل نشوند و ردیف لاگ بی‌صدا از دست برود.
 * خطای لاگ عملیات اصلی را متوقف نمی‌کند (فقط console.error).
 */
export async function logAudit(
  session: AdminSession | null,
  action: AuditAction,
  target?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const isUuid = session && /^[0-9a-f-]{36}$/i.test(session.uid);
  const { error } = await supabase.from("audit_log").insert({
    admin_user_id: isUuid ? session!.uid : null,
    actor_email: session?.email ?? null,
    action,
    target: target ?? null,
    details: details ?? null,
  });
  if (error) console.error("[audit_log]", error.message);
}
