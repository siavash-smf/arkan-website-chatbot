"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { requestIp, siteOrigin } from "@/lib/crm/doc-utils";
import {
  notifyEmail,
  proposalResponseAdminEmail,
  proposalResponseClientEmail,
  sendEmail,
} from "@/lib/crm/email";
import { recordToProposalData, type ProposalRecord } from "@/lib/crm/proposals/types";

/**
 * اکشن عمومی پاسخ کلاینت به پروپوزال — بدون نیاز به ورود.
 * امنیت از طریق view_token غیرقابل‌حدس (uuid) تأمین می‌شود (مثل صفحه‌ی قرارداد).
 * کلاینت یکی از سه کار را می‌کند: تأیید (با انتخاب بسته)، درخواست تغییر، یا رد.
 */

const ACTIONS = {
  approve: "approved",
  changes: "changes_requested",
  decline: "declined",
} as const;

export async function respondToProposal(
  token: string,
  action: keyof typeof ACTIONS,
  input: { name: string; note: string; selectedOption: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const status = ACTIONS[action];
  if (!status) return { ok: false, error: "درخواست نامعتبر است." };
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: "لینک پیشنهاد نامعتبر است." };

  const name = input.name.trim().slice(0, 120);
  const note = input.note.trim().slice(0, 3000);
  if (status === "approved" && name.length < 3) {
    return { ok: false, error: "لطفاً نام و نام خانوادگی کامل را وارد کنید." };
  }
  if (status === "changes_requested" && note.length < 3) {
    return { ok: false, error: "لطفاً بنویسید چه چیزی باید تغییر کند." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "اتصال برقرار نیست؛ بعداً تلاش کنید." };

  const { data: row } = await supabase
    .from("proposals")
    .select("*")
    .eq("view_token", token)
    .maybeSingle<ProposalRecord>();
  if (!row || row.status === "draft") return { ok: false, error: "پیشنهاد پیدا نشد." };
  if (row.status === "canceled") return { ok: false, error: "این پیشنهاد بسته شده است؛ با آرکان تماس بگیرید." };
  if (row.status === "approved" || row.status === "converted") {
    return { ok: false, error: "این پیشنهاد قبلاً تأیید شده است." };
  }

  const option =
    status === "approved"
      ? (row.options.find((o) => o.id === input.selectedOption) ?? (row.options.length === 1 ? row.options[0] : null))
      : null;
  if (status === "approved" && !option) return { ok: false, error: "لطفاً یکی از بسته‌ها را انتخاب کنید." };

  const respondedAt = new Date().toISOString();
  const ip = requestIp();
  const { data: updated, error } = await supabase
    .from("proposals")
    .update({
      status,
      responded_at: respondedAt,
      responder_name: name || row.client_name,
      responder_ip: ip,
      selected_option: option?.id ?? null,
      updated_at: respondedAt,
    })
    .eq("id", row.id)
    .eq("status", row.status) // جلوی ثبت دوباره با دو کلیک هم‌زمان را می‌گیرد
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "ثبت پاسخ ناموفق بود؛ دوباره تلاش کنید." };
  if (!updated) return { ok: false, error: "پاسخ شما همین حالا ثبت شد." };

  if (note) {
    await supabase.from("proposal_comments").insert({
      proposal_id: row.id,
      author: "client",
      body: note,
      revision: row.revision,
    });
  }

  // ایمیل‌ها: رسید برای کلاینت، اعلان برای تیم آرکان. خطای ایمیل پاسخ ثبت‌شده را باطل نمی‌کند.
  const data = recordToProposalData(row);
  const origin = siteOrigin();
  const clientMail = proposalResponseClientEmail({
    data,
    action: status,
    option,
    note: note || null,
    viewUrl: `${origin}/proposal/${token}`,
  });
  const admin = notifyEmail();
  await Promise.allSettled([
    sendEmail({ to: row.client_email, subject: clientMail.subject, html: clientMail.html, replyTo: admin }),
    admin
      ? (() => {
          const m = proposalResponseAdminEmail({
            data,
            action: status,
            option,
            note: note || null,
            responderName: name || row.client_name,
            respondedAt,
            ip,
            adminUrl: `${origin}/admin/crm/proposals/${row.id}`,
          });
          return sendEmail({ to: admin, subject: m.subject, html: m.html, replyTo: row.client_email });
        })()
      : Promise.resolve(),
  ]);

  await logAudit(null, "proposal_respond", row.id, { status, by: name || row.client_name });
  revalidatePath(`/proposal/${token}`);
  revalidatePath("/admin/crm/proposals");
  revalidatePath(`/admin/crm/proposals/${row.id}`);
  return { ok: true };
}
