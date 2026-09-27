"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { requestIp } from "@/lib/crm/doc-utils";
import { acceptedContractEmail, notifyEmail, sendEmail } from "@/lib/crm/email";

/**
 * اکشن‌های عمومی صفحه‌ی قرارداد (سمت کلاینت) — بدون نیاز به ورود.
 * امنیت از طریق share_token غیرقابل‌حدس (uuid) تأمین می‌شود.
 *
 * تأیید دو مرحله دارد (مثل Career Guide):
 *   ۱. acceptContract — نام، زمان سرور و IP ثبت می‌شود.
 *   ۲. مرورگر نسخه‌ی تأییدشده‌ی PDF را با همان زمان و نام می‌سازد و
 *      deliverAcceptedContract آن را برای کلاینت و تیم آرکان ایمیل می‌کند.
 *   جدا بودن دو مرحله یعنی زمانی که روی PDF چاپ می‌شود دقیقاً همان زمان ثبت‌شده در دیتابیس است.
 */

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

export async function acceptContract(token: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "لطفاً نام و نام خانوادگی کامل را وارد کنید." };
  }
  if (!TOKEN_RE.test(token)) {
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
      accepted_ip: requestIp(),
    })
    .eq("id", contract.id);
  if (error) return { ok: false, error: "ثبت تأیید ناموفق بود؛ دوباره تلاش کنید." };

  await logAudit(null, "contract_accept", contract.id, { accepted_by: trimmed });
  revalidatePath(`/contract/${token}`);
  revalidatePath("/admin/crm/contracts");
  return { ok: true };
}

/** نسخه‌ی تأییدشده (PDF ساخته‌شده در مرورگر) را یک بار برای طرفین ایمیل می‌کند. */
export async function deliverAcceptedContract(
  token: string,
  pdfBase64: string
): Promise<{ ok: boolean; error?: string }> {
  if (!TOKEN_RE.test(token)) return { ok: false, error: "لینک قرارداد نامعتبر است." };
  if (!pdfBase64 || pdfBase64.length > 4_200_000) return { ok: false, error: "فایل PDF نامعتبر است." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال برقرار نیست." };

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_no, title, status, accepted_at, accepted_by_name, accepted_copy_sent_at, contact:contacts(full_name, email)")
    .eq("share_token", token)
    .maybeSingle();
  if (!contract || contract.status !== "accepted" || !contract.accepted_at) {
    return { ok: false, error: "این قرارداد هنوز تأیید نشده است." };
  }
  if (contract.accepted_copy_sent_at) return { ok: true }; // قبلاً فرستاده شده

  const contact = contract.contact as unknown as { full_name: string; email: string | null } | null;
  const attachment = { filename: `${contract.contract_no}-accepted.pdf`, content: pdfBase64 };
  const base = {
    contractNo: contract.contract_no,
    title: contract.title,
    clientName: contact?.full_name ?? "کارفرما",
    acceptedBy: contract.accepted_by_name ?? "",
    acceptedAt: contract.accepted_at,
  };
  const admin = notifyEmail();

  const results = await Promise.all([
    contact?.email
      ? (() => {
          const m = acceptedContractEmail({ ...base, forAdmin: false });
          return sendEmail({ to: contact.email!, subject: m.subject, html: m.html, replyTo: admin, attachments: [attachment] });
        })()
      : Promise.resolve({ ok: false }),
    admin
      ? (() => {
          const m = acceptedContractEmail({ ...base, forAdmin: true });
          return sendEmail({ to: admin, subject: m.subject, html: m.html, attachments: [attachment] });
        })()
      : Promise.resolve({ ok: false }),
  ]);

  if (!results.some((r) => r.ok)) return { ok: false, error: "ارسال نسخه‌ی تأییدشده انجام نشد." };
  await supabase.from("contracts").update({ accepted_copy_sent_at: new Date().toISOString() }).eq("id", contract.id);
  return { ok: true };
}
