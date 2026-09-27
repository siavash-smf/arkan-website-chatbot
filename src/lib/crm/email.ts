import "server-only";
import { ARKAN } from "@/lib/documents/company";
import { faDate, faDateTime, formatToman } from "@/lib/documents/format";
import type { ProposalData, ProposalOption } from "@/lib/crm/proposals/types";

/**
 * ایمیل‌های پروپوزال و قرارداد با Resend (مستقیم با REST، مثل ارسال کمپین).
 *
 * متغیرهای محیطی:
 * - RESEND_API_KEY  — بدون آن ارسال با پیام خطای روشن متوقف می‌شود
 * - RESEND_FROM     — فرستنده؛ باید روی دامنه‌ای باشد که در Resend تأیید شده
 * - CRM_NOTIFY_EMAIL — (اختیاری) اعلان پاسخ کلاینت و نسخه‌ی تأییدشده به تیم آرکان،
 *                      و نشانی Reply-To ایمیل‌های کلاینت
 */

type Attachment = { filename: string; content: string }; // content = base64

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  attachments?: Attachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, error: "ارسال ایمیل پیکربندی نشده (RESEND_API_KEY). لینک را دستی برای کلاینت بفرستید." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Arkan <onboarding@resend.dev>",
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend خطا داد (${res.status}): ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `ارسال ایمیل ناموفق بود: ${(e as Error).message}` };
  }
}

export const notifyEmail = () => process.env.CRM_NOTIFY_EMAIL?.trim() || null;

// ── قالب مشترک ایمیل‌ها (رنگ‌های برند، RTL، فونت امن ایمیل) ─────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shell(inner: string) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
  <body dir="rtl" style="margin:0;padding:24px;background:#F7F3EC;font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#15201C;direction:rtl;text-align:right;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E7DECF;border-radius:12px;overflow:hidden;">
      <div style="background:#143A32;padding:20px 28px;">
        <div style="color:#F7F3EC;font-size:20px;font-weight:bold;">${ARKAN.brand}</div>
        <div style="color:#E7DECF;font-size:12px;margin-top:2px;">${ARKAN.tagline}</div>
      </div>
      <div style="height:3px;background:#B5853A;"></div>
      <div style="padding:26px 28px;font-size:14px;">${inner}</div>
      <div style="background:#F7F3EC;padding:14px 28px;border-top:1px solid #E7DECF;font-size:11px;color:#5A5F5B;">
        ${ARKAN.legalName} · ${ARKAN.city} · <span dir="ltr">${ARKAN.phone}</span> · <span dir="ltr">${ARKAN.email}</span>
      </div>
    </div>
  </body>
</html>`;
}

function facts(rows: [string, string][]) {
  return `<table style="width:100%;border-collapse:collapse;margin:18px 0;background:#F7F3EC;border-radius:10px;">
    ${rows
      .map(
        ([k, v]) => `<tr>
      <td style="padding:8px 14px;color:#5A5F5B;font-size:13px;width:130px;vertical-align:top;">${k}</td>
      <td style="padding:8px 14px;font-size:13px;"><strong>${v}</strong></td>
    </tr>`
      )
      .join("")}
  </table>`;
}

function button(href: string, label: string) {
  return `<p style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#143A32;color:#F7F3EC;text-decoration:none;font-weight:bold;padding:13px 32px;border-radius:8px;font-size:14px;">${label}</a>
  </p>`;
}

function quote(text: string) {
  return `<div style="background:#F7F3EC;border-right:3px solid #B5853A;border-radius:6px;padding:12px 15px;margin:0 0 16px;font-size:13px;">${esc(
    text
  ).replace(/\n/g, "<br/>")}</div>`;
}

const small = (text: string) => `<p style="font-size:12px;color:#5A5F5B;margin:0 0 6px;">${text}</p>`;

const signature = `<p style="margin:22px 0 0;">با احترام،<br/><strong>${ARKAN.repName}</strong><br/>
  <span style="font-size:12px;color:#5A5F5B;">${ARKAN.repTitle} — ${ARKAN.brand}</span></p>`;

function priceLine(options: ProposalOption[]) {
  if (!options.length) return "—";
  if (options.length === 1) return formatToman(options[0].price);
  const prices = options.map((o) => o.price);
  return `از ${formatToman(Math.min(...prices))} تا ${formatToman(Math.max(...prices))}`;
}

// ── پروپوزال ───────────────────────────────────────────────────

export function proposalEmail(data: ProposalData, viewUrl: string, note: string | null, isRevision: boolean) {
  const inner = `
    <p style="margin:0 0 14px;">${esc(data.clientName)} گرامی،</p>
    <p style="margin:0 0 14px;">${
      isRevision
        ? `نسخه‌ی بازنگری‌شده‌ی پیشنهاد همکاری با موضوع «${esc(data.title)}» بر اساس نکاتی که فرمودید آماده شد.`
        : `پیرو گفت‌وگویی که داشتیم، پیشنهاد همکاری آرکان با موضوع «${esc(data.title)}» آماده است.`
    } نسخه‌ی PDF پیوست همین ایمیل است و نسخه‌ی آنلاین را هم از دکمه‌ی زیر می‌بینید.</p>
    ${note ? quote(note) : ""}
    ${facts([
      ["شماره‌ی پیشنهاد", `<span dir="ltr">${data.proposalNo}</span>`],
      ["موضوع", esc(data.title)],
      [data.options.length > 1 ? "بسته‌ها" : "سرمایه‌گذاری", priceLine(data.options)],
      ...(data.validUntil ? ([["معتبر تا", faDate(data.validUntil)]] as [string, string][]) : []),
    ])}
    ${button(viewUrl, "مشاهده‌ی پیشنهاد و اعلام نظر")}
    ${small("در همان صفحه می‌توانید بسته‌ی موردنظرتان را انتخاب و پیشنهاد را تأیید کنید، یا اگر نکته‌ای دارید همان‌جا بنویسید تا اصلاحش کنیم.")}
    ${small("این پیشنهاد در این مرحله تعهد حقوقی ایجاد نمی‌کند. پس از تأیید شما، قرارداد رسمی برای تأیید آنلاین ارسال می‌شود.")}
    ${signature}`;
  return {
    subject: `${isRevision ? "نسخه‌ی بازنگری‌شده‌ی پیشنهاد" : "پیشنهاد همکاری"} ${data.proposalNo} — ${data.title}`,
    html: shell(inner),
  };
}

type Response = "approved" | "changes_requested" | "declined";

const RESPONSE_LABEL: Record<Response, string> = {
  approved: "پیشنهاد تأیید شد",
  changes_requested: "کلاینت درخواست تغییر داد",
  declined: "پیشنهاد رد شد",
};

/** اعلان پاسخ کلاینت به تیم آرکان. */
export function proposalResponseAdminEmail(input: {
  data: ProposalData;
  action: Response;
  option: ProposalOption | null;
  note: string | null;
  responderName: string;
  respondedAt: string;
  ip: string | null;
  adminUrl: string;
}) {
  const { data, action, option } = input;
  const inner = `
    <p style="margin:0 0 14px;"><strong>${RESPONSE_LABEL[action]}</strong></p>
    ${facts([
      ["شماره‌ی پیشنهاد", `<span dir="ltr">${data.proposalNo}</span>`],
      ["کلاینت", esc(data.clientName)],
      ["موضوع", esc(data.title)],
      ...(option ? ([["بسته‌ی انتخابی", `${esc(option.name)} — ${formatToman(option.price)}`]] as [string, string][]) : []),
      ["پاسخ‌دهنده", esc(input.responderName)],
      ["زمان", faDateTime(input.respondedAt)],
      ["نشانی IP", `<span dir="ltr">${input.ip ?? "—"}</span>`],
    ])}
    ${input.note ? `${small("یادداشت کلاینت:")}${quote(input.note)}` : ""}
    ${button(input.adminUrl, action === "approved" ? "ساخت قرارداد از روی پیشنهاد" : "مشاهده در پنل")}`;
  return { subject: `${RESPONSE_LABEL[action]} — ${data.proposalNo} (${data.clientName})`, html: shell(inner) };
}

/** رسید پاسخ برای خود کلاینت. */
export function proposalResponseClientEmail(input: {
  data: ProposalData;
  action: Response;
  option: ProposalOption | null;
  note: string | null;
  viewUrl: string;
}) {
  const { data, action, option } = input;
  const body =
    action === "approved"
      ? `تأیید شما برای پیشنهاد <strong>${data.proposalNo}</strong> ثبت شد.${
          option ? ` بسته‌ی انتخابی شما: <strong>${esc(option.name)}</strong> — ${formatToman(option.price)}.` : ""
        } قرارداد رسمی را به‌زودی برای تأیید آنلاین برایتان می‌فرستیم.`
      : action === "changes_requested"
        ? `نکات شما درباره‌ی پیشنهاد <strong>${data.proposalNo}</strong> به دست ما رسید. آن‌ها را بررسی می‌کنیم و نسخه‌ی بازنگری‌شده را برایتان می‌فرستیم.`
        : `پاسخ شما درباره‌ی پیشنهاد <strong>${data.proposalNo}</strong> ثبت شد. از وقتی که گذاشتید سپاسگزاریم؛ اگر در آینده موضوعی پیش آمد، در خدمت شما هستیم.`;
  const inner = `
    <p style="margin:0 0 14px;">${esc(data.clientName)} گرامی،</p>
    <p style="margin:0 0 14px;">${body}</p>
    ${input.note ? `${small("آنچه نوشتید:")}${quote(input.note)}` : ""}
    ${action !== "declined" ? small(`نسخه‌ی آنلاین پیشنهاد همیشه در دسترس شماست: <a href="${input.viewUrl}" style="color:#143A32;">مشاهده‌ی پیشنهاد</a>`) : ""}
    ${signature}`;
  return { subject: `پاسخ شما درباره‌ی پیشنهاد ${data.proposalNo} ثبت شد`, html: shell(inner) };
}

/** پاسخ مکتوب آرکان به یادداشت کلاینت روی پروپوزال. */
export function proposalReplyEmail(data: ProposalData, body: string, viewUrl: string) {
  const inner = `
    <p style="margin:0 0 14px;">${esc(data.clientName)} گرامی،</p>
    <p style="margin:0 0 14px;">درباره‌ی نکاتی که روی پیشنهاد <strong>${data.proposalNo}</strong> نوشتید:</p>
    ${quote(body)}
    ${button(viewUrl, "مشاهده‌ی پیشنهاد")}
    ${signature}`;
  return { subject: `پاسخ به نکات شما — پیشنهاد ${data.proposalNo}`, html: shell(inner) };
}

// ── قرارداد ────────────────────────────────────────────────────

export function contractEmail(input: {
  contractNo: string;
  title: string;
  clientName: string;
  amountToman: number;
  durationLabel: string | null;
  viewUrl: string;
  note: string | null;
}) {
  const inner = `
    <p style="margin:0 0 14px;">${esc(input.clientName)} گرامی،</p>
    <p style="margin:0 0 14px;">قرارداد «${esc(input.title)}» برای بررسی و تأیید شما آماده است. نسخه‌ی PDF پیوست همین ایمیل است و از دکمه‌ی زیر می‌توانید متن کامل را ببینید و آنلاین تأیید کنید.</p>
    ${input.note ? quote(input.note) : ""}
    ${facts([
      ["شماره‌ی قرارداد", `<span dir="ltr">${input.contractNo}</span>`],
      ["موضوع", esc(input.title)],
      ...(input.amountToman > 0 ? ([["مبلغ", formatToman(input.amountToman)]] as [string, string][]) : []),
      ...(input.durationLabel ? ([["مدت", esc(input.durationLabel)]] as [string, string][]) : []),
    ])}
    ${button(input.viewUrl, "مشاهده و تأیید قرارداد")}
    ${small("تأیید آنلاین با ثبت نام شما، زمان و نشانی IP انجام می‌شود و پس از آن نسخه‌ی تأییدشده برایتان ایمیل می‌شود.")}
    ${signature}`;
  return { subject: `قرارداد ${input.contractNo} — ${input.title}`, html: shell(inner) };
}

export function acceptedContractEmail(input: {
  contractNo: string;
  title: string;
  clientName: string;
  acceptedBy: string;
  acceptedAt: string;
  forAdmin: boolean;
}) {
  const inner = `
    <p style="margin:0 0 14px;">${input.forAdmin ? "قرارداد زیر توسط کارفرما تأیید شد." : `${esc(input.clientName)} گرامی،`}</p>
    ${input.forAdmin ? "" : `<p style="margin:0 0 14px;">تأیید شما برای قرارداد «${esc(input.title)}» ثبت شد. نسخه‌ی تأییدشده‌ی قرارداد پیوست همین ایمیل است؛ لطفاً آن را نزد خود نگه دارید.</p>`}
    ${facts([
      ["شماره‌ی قرارداد", `<span dir="ltr">${input.contractNo}</span>`],
      ["موضوع", esc(input.title)],
      ["تأییدکننده", esc(input.acceptedBy)],
      ["زمان تأیید", faDateTime(input.acceptedAt)],
    ])}
    ${input.forAdmin ? "" : `<p style="margin:0 0 14px;">به‌زودی برای هماهنگی جلسه‌ی شروع پروژه با شما تماس می‌گیریم.</p>`}
    ${signature}`;
  return {
    subject: input.forAdmin
      ? `قرارداد ${input.contractNo} تأیید شد (${input.clientName})`
      : `نسخه‌ی تأییدشده‌ی قرارداد ${input.contractNo}`,
    html: shell(inner),
  };
}
