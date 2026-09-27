"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, canWrite, type AdminSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { moveDealStage } from "@/app/admin/crm-actions";
import { buildDefaultContract } from "@/lib/crm/contract-template";
import { nextDocNumber, siteOrigin } from "@/lib/crm/doc-utils";
import { proposalEmail, proposalReplyEmail, sendEmail } from "@/lib/crm/email";
import { pickOption, recordToProposalData, sendRevision, type ProposalRecord } from "@/lib/crm/proposals/types";

/**
 * سرور‌اکشن‌های پروپوزال.
 * الگو همان crm-actions است: نشست → اجازه‌ی نوشتن → zod → عملیات → audit → revalidate.
 *
 * جریان ارسال دو مرحله دارد چون PDF در مرورگر ساخته می‌شود:
 *   ۱. saveProposal  — ذخیره و گرفتن شماره‌ی واقعی (AP-1405-…)
 *   ۲. مرورگر سند را با همان شماره می‌چیند، PDF می‌سازد و sendProposal را با PDF صدا می‌زند.
 */

type ActionResult = { ok: boolean; error?: string; id?: string };

const UNAUTHORIZED: ActionResult = { ok: false, error: "دسترسی غیرمجاز." };
const READ_ONLY: ActionResult = { ok: false, error: "نقش شما اجازه‌ی تغییر ندارد." };
const NO_DB: ActionResult = { ok: false, error: "اتصال پایگاه داده برقرار نیست." };

function guard(): { session: AdminSession } | { fail: ActionResult } {
  const session = getSession();
  if (!session) return { fail: UNAUTHORIZED };
  if (!canWrite(session)) return { fail: READ_ONLY };
  return { session };
}

function revalidateProposals(id?: string) {
  revalidatePath("/admin/crm/proposals");
  if (id) revalidatePath(`/admin/crm/proposals/${id}`);
}

// ── اعتبارسنجی ورودی فرم ─────────────────────────────────────────

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);
const list = z.array(z.string().trim().min(1).max(600)).max(20);

const phaseSchema = z.object({
  title: z.string().trim().min(1, "هر مرحله باید عنوان داشته باشد.").max(200),
  detail: text(2000),
  duration: text(80),
});

const optionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1, "هر بسته باید نام داشته باشد.").max(120),
  tagline: text(200),
  price: z.coerce.number().int().positive("مبلغ هر بسته باید بیشتر از صفر باشد."),
  recommended: z.boolean().optional(),
  features: list,
  paymentNote: text(300),
  durationNote: text(80),
});

const proposalSchema = z.object({
  contact_id: z.string().uuid().nullable(),
  deal_id: z.string().uuid().nullable(),
  client_name: z.string().trim().min(2, "نام کلاینت الزامی است.").max(120),
  client_email: z.string().trim().toLowerCase().email("ایمیل کلاینت معتبر نیست."),
  client_company: text(160),
  client_phone: text(40),
  title: z.string().trim().min(3, "عنوان پیشنهاد الزامی است.").max(200),
  intro: text(3000),
  understanding: list,
  goals: list,
  phases: z.array(phaseSchema).max(12),
  deliverables: list,
  methodology: text(4000),
  timeline_note: text(1500),
  exclusions: list,
  assumptions: list,
  why_us: list,
  next_steps: list,
  terms_note: text(3000),
  options: z
    .array(optionSchema)
    .min(1, "دست‌کم یک بسته با نام و مبلغ لازم است.")
    .max(4)
    .refine((opts) => new Set(opts.map((o) => o.id)).size === opts.length, "شناسه‌ی بسته‌ها تکراری است."),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ اعتبار نامعتبر است.")
    .nullable()
    .or(z.literal("").transform(() => null)),
});

export type ProposalInput = z.input<typeof proposalSchema>;

// ── ذخیره (ساخت یا ویرایش) ───────────────────────────────────────

export async function saveProposal(
  id: string | null,
  input: ProposalInput
): Promise<ActionResult & { record?: ProposalRecord }> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  if (id) {
    const { data: existing } = await supabase.from("proposals").select("status").eq("id", id).maybeSingle();
    if (!existing) return { ok: false, error: "پروپوزال پیدا نشد." };
    if (existing.status === "converted") {
      return { ok: false, error: "این پروپوزال به قرارداد تبدیل شده و دیگر ویرایش نمی‌شود." };
    }
    const { data, error } = await supabase
      .from("proposals")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };

    await logAudit(g.session, "proposal_update", id);
    revalidateProposals(id);
    return { ok: true, id, record: data as ProposalRecord };
  }

  const proposalNo = await nextDocNumber(supabase, "proposals", "proposal_no", "AP");
  const { data, error } = await supabase
    .from("proposals")
    .insert({ ...parsed.data, proposal_no: proposalNo, created_by: g.session.email })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "proposal_create", data.id, { proposal_no: proposalNo });
  revalidateProposals();
  return { ok: true, id: data.id, record: data as ProposalRecord };
}

// ── ارسال با ایمیل (PDF پیوست) ───────────────────────────────────

export async function sendProposal(id: string, pdfBase64: string, note: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  if (!pdfBase64 || pdfBase64.length > 4_200_000) {
    return { ok: false, error: "فایل PDF نامعتبر یا بیش از حد بزرگ است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: row } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle<ProposalRecord>();
  if (!row) return { ok: false, error: "پروپوزال پیدا نشد." };
  if (row.status === "converted" || row.status === "canceled") {
    return { ok: false, error: "پروپوزال تبدیل‌شده یا لغوشده ارسال نمی‌شود." };
  }

  const revision = sendRevision(row);
  const sentAt = new Date().toISOString();
  const data = recordToProposalData({ ...row, revision, sent_at: sentAt });
  const viewUrl = `${siteOrigin()}/proposal/${row.view_token}`;
  const mail = proposalEmail(data, viewUrl, note.trim() || null, !!row.sent_at);

  const sent = await sendEmail({
    to: row.client_email,
    subject: mail.subject,
    html: mail.html,
    replyTo: process.env.CRM_NOTIFY_EMAIL || null,
    attachments: [{ filename: `${row.proposal_no}${revision > 1 ? `-v${revision}` : ""}.pdf`, content: pdfBase64 }],
  });
  if (!sent.ok) return { ok: false, error: sent.error };

  const { error } = await supabase
    .from("proposals")
    .update({
      status: "sent",
      sent_at: sentAt,
      revision,
      // نسخه‌ی تازه، گفت‌وگو را از نو شروع می‌کند
      responded_at: null,
      selected_option: null,
      responder_name: null,
      updated_at: sentAt,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // معامله‌ی مرتبط که هنوز به مرحله‌ی پروپوزال نرسیده، جلو می‌رود
  if (row.deal_id) {
    const { data: deal } = await supabase.from("deals").select("stage_key, status").eq("id", row.deal_id).maybeSingle();
    if (deal?.status === "open" && ["new", "qualifying", "meeting"].includes(deal.stage_key)) {
      await moveDealStage(row.deal_id, "proposal");
    }
  }

  await logAudit(g.session, "proposal_send", id, { revision, to: row.client_email });
  revalidateProposals(id);
  return { ok: true };
}

// ── گفت‌وگو و وضعیت ─────────────────────────────────────────────

export async function replyToProposal(id: string, body: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const message = body.trim();
  if (message.length < 2) return { ok: false, error: "متن پاسخ خالی است." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: row } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle<ProposalRecord>();
  if (!row) return { ok: false, error: "پروپوزال پیدا نشد." };

  const { error } = await supabase.from("proposal_comments").insert({
    proposal_id: id,
    author: "admin",
    body: message,
    revision: row.revision,
    created_by: g.session.email,
  });
  if (error) return { ok: false, error: error.message };

  const mail = proposalReplyEmail(recordToProposalData(row), message, `${siteOrigin()}/proposal/${row.view_token}`);
  const sent = await sendEmail({
    to: row.client_email,
    subject: mail.subject,
    html: mail.html,
    replyTo: process.env.CRM_NOTIFY_EMAIL || null,
  });

  await logAudit(g.session, "proposal_reply", id);
  revalidateProposals(id);
  // پاسخ در رشته ثبت شده؛ اگر فقط ایمیل نرفت، همان را بگوییم
  return sent.ok ? { ok: true } : { ok: false, error: `پاسخ ثبت شد، اما ${sent.error}` };
}

export async function cancelProposal(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("proposals")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "converted");
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "proposal_cancel", id);
  revalidateProposals(id);
  return { ok: true };
}

export async function reopenProposal(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: row } = await supabase.from("proposals").select("status, sent_at").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "پروپوزال پیدا نشد." };
  if (row.status === "converted") return { ok: false, error: "این پروپوزال به قرارداد تبدیل شده است." };

  const { error } = await supabase
    .from("proposals")
    .update({ status: row.sent_at ? "sent" : "draft", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "proposal_reopen", id);
  revalidateProposals(id);
  return { ok: true };
}

export async function deleteProposal(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("proposals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "proposal_delete", id);
  revalidateProposals();
  return { ok: true };
}

// ── تبدیل به قرارداد ────────────────────────────────────────────

/**
 * پروپوزال (ترجیحاً تأییدشده) را به قرارداد تبدیل می‌کند:
 * بسته‌ی انتخابی ← مبلغ و مدت و شرایط پرداخت، مراحل ← شرح خدمات،
 * خروجی‌ها و موارد خارج از دامنه ← ماده‌های مربوط در قرارداد.
 * اگر پروپوزال دستی نوشته شده و به مخاطبی وصل نیست، مخاطب (و شرکت) در CRM ساخته می‌شود.
 */
export async function convertProposalToContract(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: row } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle<ProposalRecord>();
  if (!row) return { ok: false, error: "پروپوزال پیدا نشد." };
  if (row.status === "converted" && row.contract_id) return { ok: true, id: row.contract_id };
  if (row.status === "canceled" || row.status === "declined") {
    return { ok: false, error: "پروپوزال لغوشده یا ردشده به قرارداد تبدیل نمی‌شود." };
  }

  const option = pickOption(row.options, row.selected_option);
  if (!option) return { ok: false, error: "این پروپوزال بسته‌ای ندارد." };

  // ۱. مخاطب: وصل‌شده، یا با همین ایمیل، یا تازه
  let contactId = row.contact_id;
  if (!contactId) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", row.client_email)
      .limit(1)
      .maybeSingle();
    contactId = existing?.id ?? null;
  }
  if (!contactId) {
    let companyId: string | null = null;
    if (row.client_company) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("name", row.client_company)
        .limit(1)
        .maybeSingle();
      companyId = company?.id ?? null;
      if (!companyId) {
        const { data: created, error } = await supabase
          .from("companies")
          .insert({ name: row.client_company })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };
        companyId = created.id;
      }
    }
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        full_name: row.client_name,
        email: row.client_email,
        phone: row.client_phone,
        company_id: companyId,
        source: "manual",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    contactId = created.id;
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, company_id, company:companies(name)")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "مخاطب پیدا نشد." };
  const company = contact.company as unknown as { name: string } | null;

  // ۲. قرارداد با متن قالب آرکان + جزئیات پروپوزال
  const body = buildDefaultContract({
    clientName: contact.full_name,
    companyName: company?.name ?? row.client_company,
    dealTitle: row.title,
    amountToman: option.price,
    startDate: null,
    durationLabel: option.durationNote ?? null,
    proposalNo: row.proposal_no,
    packageName: row.options.length > 1 ? option.name : null,
    scope: row.phases.map((p) => (p.detail ? `**${p.title}:** ${p.detail}` : p.title)),
    deliverables: row.deliverables,
    exclusions: row.exclusions,
    paymentNote: option.paymentNote ?? null,
  });

  const contractNo = await nextDocNumber(supabase, "contracts", "contract_no", "AR");
  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      contract_no: contractNo,
      title: `قرارداد ${row.title}`,
      contact_id: contact.id,
      deal_id: row.deal_id,
      company_id: contact.company_id,
      body_md: body,
      amount_toman: option.price,
      duration_label: option.durationNote ?? null,
      proposal_id: row.id,
      created_by: g.session.email,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("proposals")
    .update({
      status: "converted",
      contract_id: contract.id,
      contact_id: contact.id,
      selected_option: row.selected_option ?? option.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  await logAudit(g.session, "proposal_convert", id, { contract_no: contractNo });
  await logAudit(g.session, "contract_create", contract.id, { contract_no: contractNo, from_proposal: row.proposal_no });
  revalidateProposals(id);
  revalidatePath("/admin/crm/contracts");
  return { ok: true, id: contract.id };
}
