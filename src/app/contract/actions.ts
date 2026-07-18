"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

/**
 * اکشن عمومی تأیید قرارداد توسط کلاینت — بدون نیاز به ورود.
 * امنیت از طریق share_token غیرقابل‌حدس (uuid) تأمین می‌شود.
 */
export async function acceptContract(
  token: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "لطفاً نام و نام خانوادگی کامل را وارد کنید." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return { ok: false, error: "لینک قرارداد نامعتبر است." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال برقرار نیست؛ بعداً تلاش کنید." };

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status")
    .eq("share_token", token)
    .maybeSingle();
  if (!contract) return { ok: false, error: "قرارداد پیدا نشد." };
  if (contract.status === "canceled") {
    return { ok: false, error: "این قرارداد لغو شده است؛ با آرکان تماس بگیرید." };
  }
  if (contract.status === "accepted") {
    return { ok: true }; // قبلاً تأیید شده — idempotent
  }

  const { error } = await supabase
    .from("contracts")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_name: trimmed,
    })
    .eq("id", contract.id);
  if (error) return { ok: false, error: "ثبت تأیید ناموفق بود؛ دوباره تلاش کنید." };

  await logAudit(null, "contract_accept", contract.id, { accepted_by: trimmed });
  revalidatePath(`/contract/${token}`);
  revalidatePath("/admin/crm/contracts");
  return { ok: true };
}
