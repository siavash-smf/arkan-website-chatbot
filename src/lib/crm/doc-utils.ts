import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jalaliYear } from "@/lib/documents/format";

/** ابزارهای سمت سرور برای اسناد CRM (پروپوزال و قرارداد). */

/**
 * شماره‌ی خوانای اسناد: <پیشوند>-<سال شمسی>-<شماره‌ی ترتیبی سه‌رقمی>
 * مثل AP-1405-004 (پروپوزال) یا AR-1405-012 (قرارداد).
 * شماره‌ی بعدی از بزرگ‌ترین شماره‌ی همان سال حساب می‌شود، نه از تعداد ردیف‌ها؛
 * پس حذف یک سند باعث تکرار شماره نمی‌شود.
 */
export async function nextDocNumber(
  supabase: SupabaseClient,
  table: "proposals" | "contracts",
  column: "proposal_no" | "contract_no",
  prefix: "AP" | "AR"
): Promise<string> {
  const base = `${prefix}-${jalaliYear()}-`;
  const { data } = await supabase
    .from(table)
    .select(column)
    .like(column, `${base}%`)
    .order(column, { ascending: false })
    .limit(1);
  const last = (data?.[0] as Record<string, string> | undefined)?.[column];
  const next = last ? Number(last.slice(base.length)) + 1 : 1;
  return `${base}${String(Number.isFinite(next) ? next : 1).padStart(3, "0")}`;
}

/** نشانی پایه‌ی سایت از هاست همین درخواست (روی preview و production هر دو درست است). */
export function siteOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** IP درخواست‌دهنده — شاهد تأیید آنلاین کلاینت. */
export function requestIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
