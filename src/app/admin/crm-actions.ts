"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, canWrite, type AdminSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import {
  scoreLead,
  summarizeConversation,
  nextBestAction,
  draftContractBody,
  generateCampaignEmail,
  generateContractFollowup,
  suggestBlogContent,
} from "@/lib/crm/ai";
import { buildDefaultContract } from "@/lib/crm/contract-template";
import { buildSegment, SEGMENTS } from "@/lib/crm/segments";
import { listPublishedPosts } from "@/lib/blog";

/**
 * سرور‌اکشن‌های ماژول CRM.
 * الگوی هر اکشن: نشست → اجازه‌ی نوشتن → اعتبارسنجی zod → عملیات → audit → revalidate.
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

function revalidateCrm() {
  revalidatePath("/admin/crm/contacts");
  revalidatePath("/admin/crm/companies");
  revalidatePath("/admin/crm/deals");
  revalidatePath("/admin/crm/activities");
  revalidatePath("/admin/leads");
}

// ── تبدیل لید به مخاطب/شرکت/معامله ───────────────────────────────

const convertSchema = z.object({
  createDeal: z.boolean(),
  dealTitle: z.string().trim().max(200).optional(),
  amountToman: z.coerce.number().int().min(0).optional(),
});

export async function convertLead(
  leadId: string,
  options: z.infer<typeof convertSchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = convertSchema.safeParse(options);
  if (!parsed.success) return { ok: false, error: "ورودی نامعتبر است." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) return { ok: false, error: leadError?.message ?? "لید پیدا نشد." };
  if (lead.converted_at) return { ok: false, error: "این لید قبلاً تبدیل شده است." };

  // ۱) شرکت: پیدا کن یا بساز (بر اساس نام کسب‌وکار)
  let companyId: string | null = null;
  if (lead.business_name) {
    // escape کردن wildcardهای LIKE تا نام‌هایی مثل «۱۰۰% ارگانیک» به شرکت غلط نچسبند
    const pattern = lead.business_name.replace(/[\\%_]/g, "\\$&");
    const { data: matches } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", pattern)
      .limit(1);
    const existing = matches?.[0];
    if (existing) {
      companyId = existing.id;
    } else {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ name: lead.business_name, industry: lead.industry })
        .select("id")
        .single();
      if (companyError) return { ok: false, error: companyError.message };
      companyId = company.id;
    }
  }

  // ۲) مخاطب
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      company_id: companyId,
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source ?? "website",
      lead_id: lead.id,
      conversation_id: lead.conversation_id,
    })
    .select("id")
    .single();
  if (contactError) return { ok: false, error: contactError.message };

  // ۳) معامله (اختیاری)
  if (parsed.data.createDeal) {
    const { error: dealError } = await supabase.from("deals").insert({
      title: parsed.data.dealTitle?.trim() || `مشاوره — ${lead.business_name ?? lead.full_name}`,
      contact_id: contact.id,
      company_id: companyId,
      amount_toman: parsed.data.amountToman ?? 0,
      owner_email: g.session.email,
    });
    if (dealError) return { ok: false, error: dealError.message };
  }

  // ۴) فعالیت آغازین تایم‌لاین از متن چالش لید
  await supabase.from("activities").insert({
    contact_id: contact.id,
    type: "note",
    title: "تبدیل از لید",
    body: lead.challenge ? `چالش اعلام‌شده: ${lead.challenge}` : null,
    created_by: g.session.email,
  });

  // ۵) نشانه‌گذاری لید
  const { error: updateError } = await supabase
    .from("leads")
    .update({ converted_at: new Date().toISOString(), contact_id: contact.id })
    .eq("id", leadId);
  if (updateError) return { ok: false, error: updateError.message };

  await logAudit(g.session, "lead_convert", leadId, {
    contact_id: contact.id,
    company_id: companyId,
    deal_created: parsed.data.createDeal,
  });
  revalidateCrm();
  return { ok: true, id: contact.id };
}

// ── مخاطبان ──────────────────────────────────────────────────────

const contactSchema = z.object({
  full_name: z.string().trim().min(2, "نام را وارد کنید.").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("ایمیل نامعتبر است.").optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
  company_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

function emptyToNull(value: string | undefined): string | null {
  return value ? value : null;
}

export async function createContact(
  input: z.infer<typeof contactSchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      full_name: parsed.data.full_name,
      phone: emptyToNull(parsed.data.phone),
      email: emptyToNull(parsed.data.email),
      position: emptyToNull(parsed.data.position),
      company_id: emptyToNull(parsed.data.company_id),
      notes: emptyToNull(parsed.data.notes),
      source: "manual",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "contact_create", data.id);
  revalidateCrm();
  return { ok: true, id: data.id };
}

export async function updateContact(
  id: string,
  input: z.infer<typeof contactSchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const newCompanyId = emptyToNull(parsed.data.company_id);
  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: parsed.data.full_name,
      phone: emptyToNull(parsed.data.phone),
      email: emptyToNull(parsed.data.email),
      position: emptyToNull(parsed.data.position),
      company_id: newCompanyId,
      notes: emptyToNull(parsed.data.notes),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // company_id معاملات از مخاطب denormalize شده؛ همگام نگه داشته شود
  // تا شمارنده‌ها و گزارش‌های شرکت درست بمانند.
  await supabase.from("deals").update({ company_id: newCompanyId }).eq("contact_id", id);

  await logAudit(g.session, "contact_update", id);
  revalidateCrm();
  revalidatePath(`/admin/crm/contacts/${id}`);
  return { ok: true };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "contact_delete", id);
  revalidateCrm();
  return { ok: true };
}

// ── شرکت‌ها ──────────────────────────────────────────────────────

const companySchema = z.object({
  name: z.string().trim().min(2, "نام شرکت را وارد کنید.").max(160),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  size_label: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function createCompany(
  input: z.infer<typeof companySchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: parsed.data.name,
      industry: emptyToNull(parsed.data.industry),
      website: emptyToNull(parsed.data.website),
      city: emptyToNull(parsed.data.city),
      size_label: emptyToNull(parsed.data.size_label),
      notes: emptyToNull(parsed.data.notes),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "company_create", data.id);
  revalidateCrm();
  return { ok: true, id: data.id };
}

export async function updateCompany(
  id: string,
  input: z.infer<typeof companySchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      industry: emptyToNull(parsed.data.industry),
      website: emptyToNull(parsed.data.website),
      city: emptyToNull(parsed.data.city),
      size_label: emptyToNull(parsed.data.size_label),
      notes: emptyToNull(parsed.data.notes),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "company_update", id);
  revalidateCrm();
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "company_delete", id);
  revalidateCrm();
  return { ok: true };
}

// ── معاملات ──────────────────────────────────────────────────────

const dealSchema = z.object({
  title: z.string().trim().min(2, "عنوان معامله را وارد کنید.").max(200),
  contact_id: z.string().uuid("مخاطب را انتخاب کنید."),
  amount_toman: z.coerce.number().int().min(0).default(0),
  expected_close: z.string().optional().or(z.literal("")),
});

export async function createDeal(input: z.infer<typeof dealSchema>): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  // company_id از مخاطب به ارث می‌رسد
  const { data: contact } = await supabase
    .from("contacts")
    .select("company_id")
    .eq("id", parsed.data.contact_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("deals")
    .insert({
      title: parsed.data.title,
      contact_id: parsed.data.contact_id,
      company_id: contact?.company_id ?? null,
      amount_toman: parsed.data.amount_toman,
      expected_close: parsed.data.expected_close || null,
      owner_email: g.session.email,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "deal_create", data.id, { amount_toman: parsed.data.amount_toman });
  revalidateCrm();
  return { ok: true, id: data.id };
}

const dealUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  amount_toman: z.coerce.number().int().min(0),
  expected_close: z.string().optional().or(z.literal("")),
});

export async function updateDeal(
  id: string,
  input: z.infer<typeof dealUpdateSchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = dealUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("deals")
    .update({
      title: parsed.data.title,
      amount_toman: parsed.data.amount_toman,
      expected_close: parsed.data.expected_close || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "deal_update", id);
  revalidateCrm();
  return { ok: true };
}

/**
 * جابه‌جایی معامله به مرحله‌ی جدید (درگ کانبان یا select).
 * ورود به مرحله‌ی won/lost وضعیت و تاریخ بسته‌شدن را خودکار ست می‌کند
 * و همیشه یک فعالیت stage_change در تایم‌لاین ثبت می‌شود.
 */
export async function moveDealStage(
  dealId: string,
  stageKey: string,
  lostReason?: string
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const [{ data: stage }, { data: deal }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").eq("key", stageKey).maybeSingle(),
    supabase
      .from("deals")
      .select("id, title, contact_id, stage_key")
      .eq("id", dealId)
      .maybeSingle(),
  ]);
  if (!stage) return { ok: false, error: "مرحله‌ی نامعتبر است." };
  if (!deal) return { ok: false, error: "معامله پیدا نشد." };
  if (deal.stage_key === stageKey) return { ok: true };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("deals")
    .update({
      stage_key: stageKey,
      stage_entered_at: now,
      status: stage.is_won ? "won" : stage.is_lost ? "lost" : "open",
      won_at: stage.is_won ? now : null,
      lost_at: stage.is_lost ? now : null,
      lost_reason: stage.is_lost ? (lostReason?.trim() || null) : null,
      updated_at: now,
    })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activities").insert({
    contact_id: deal.contact_id,
    deal_id: dealId,
    type: "stage_change",
    title: `انتقال به مرحله‌ی «${stage.label_fa}»`,
    body: stage.is_lost && lostReason ? `دلیل شکست: ${lostReason}` : null,
    created_by: g.session.email,
  });

  await logAudit(g.session, "deal_stage_change", dealId, {
    from: deal.stage_key,
    to: stageKey,
    lost_reason: lostReason ?? null,
  });
  revalidateCrm();
  return { ok: true };
}

export async function deleteDeal(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "deal_delete", id);
  revalidateCrm();
  return { ok: true };
}

// ── فعالیت‌ها ────────────────────────────────────────────────────

const activitySchema = z.object({
  contact_id: z.string().uuid().optional().or(z.literal("")),
  deal_id: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["call", "meeting", "note", "task"]),
  title: z.string().trim().min(2, "عنوان فعالیت را وارد کنید.").max(200),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
  due_at: z.string().optional().or(z.literal("")),
});

export async function createActivity(
  input: z.infer<typeof activitySchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  if (!parsed.data.contact_id && !parsed.data.deal_id) {
    return { ok: false, error: "فعالیت باید به یک مخاطب یا معامله متصل باشد." };
  }
  // کلاینت سررسید را به ISO (لحظه‌ی واقعی در تایم‌زون کاربر) تبدیل می‌کند؛
  // اینجا فقط اعتبارسنجی می‌شود تا ورودی خراب 500 نشود.
  let dueAtIso: string | null = null;
  if (parsed.data.due_at) {
    const due = new Date(parsed.data.due_at);
    if (isNaN(due.getTime())) return { ok: false, error: "تاریخ سررسید نامعتبر است." };
    dueAtIso = due.toISOString();
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data, error } = await supabase
    .from("activities")
    .insert({
      contact_id: emptyToNull(parsed.data.contact_id),
      deal_id: emptyToNull(parsed.data.deal_id),
      type: parsed.data.type,
      title: parsed.data.title,
      body: emptyToNull(parsed.data.body),
      due_at: dueAtIso,
      created_by: g.session.email,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "activity_create", data.id, { type: parsed.data.type });
  revalidateCrm();
  revalidatePath("/admin");
  return { ok: true, id: data.id };
}

export async function completeActivity(id: string, done: boolean): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("activities")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, done ? "activity_complete" : "activity_reopen", id);
  revalidateCrm();
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "activity_delete", id);
  revalidateCrm();
  return { ok: true };
}

// ── قراردادها ────────────────────────────────────────────────────

const contractSchema = z.object({
  title: z.string().trim().min(2, "عنوان قرارداد را وارد کنید.").max(200),
  contact_id: z.string().uuid("مخاطب را انتخاب کنید."),
  deal_id: z.string().uuid().optional().or(z.literal("")),
  amount_toman: z.coerce.number().int().min(0).default(0),
  start_date: z.string().optional().or(z.literal("")),
  duration_label: z.string().trim().max(60).optional().or(z.literal("")),
});

/** ساخت قرارداد با متن پیش‌فرض قالب آرکان (از روی مخاطب/معامله). */
export async function createContract(
  input: z.infer<typeof contractSchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const [{ data: contact }, { data: deal }, { count }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, company_id, lead_id, company:companies(name)")
      .eq("id", parsed.data.contact_id)
      .maybeSingle(),
    parsed.data.deal_id
      ? supabase.from("deals").select("id, title, amount_toman").eq("id", parsed.data.deal_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("contracts").select("id", { count: "exact", head: true }),
  ]);
  if (!contact) return { ok: false, error: "مخاطب پیدا نشد." };

  // شماره‌ی قرارداد: AR-<سال شمسی>-<شماره ترتیبی>
  const faYear = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric" }).format(new Date());
  const contractNo = `AR-${faYear}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  let challenge: string | null = null;
  if (contact.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("challenge")
      .eq("id", contact.lead_id)
      .maybeSingle();
    challenge = lead?.challenge ?? null;
  }

  const company = contact.company as unknown as { name: string } | null;
  const amount = parsed.data.amount_toman || deal?.amount_toman || 0;
  const body = buildDefaultContract({
    clientName: contact.full_name,
    companyName: company?.name ?? null,
    dealTitle: deal?.title ?? parsed.data.title,
    amountToman: amount,
    startDate: parsed.data.start_date || null,
    durationLabel: parsed.data.duration_label || null,
    challenge,
  });

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      contract_no: contractNo,
      title: parsed.data.title,
      contact_id: contact.id,
      deal_id: parsed.data.deal_id || null,
      company_id: contact.company_id,
      body_md: body,
      amount_toman: amount,
      start_date: parsed.data.start_date || null,
      duration_label: parsed.data.duration_label || null,
      created_by: g.session.email,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "contract_create", data.id, { contract_no: contractNo });
  revalidatePath("/admin/crm/contracts");
  return { ok: true, id: data.id };
}

const contractUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body_md: z.string().trim().min(50, "متن قرارداد خیلی کوتاه است."),
  amount_toman: z.coerce.number().int().min(0),
  start_date: z.string().optional().or(z.literal("")),
  duration_label: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function updateContract(
  id: string,
  input: z.infer<typeof contractUpdateSchema>
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const parsed = contractUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: existing } = await supabase
    .from("contracts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "قرارداد پیدا نشد." };
  if (existing.status === "accepted") {
    return { ok: false, error: "قرارداد تأییدشده قابل ویرایش نیست." };
  }

  const { error } = await supabase
    .from("contracts")
    .update({
      title: parsed.data.title,
      body_md: parsed.data.body_md,
      amount_toman: parsed.data.amount_toman,
      start_date: parsed.data.start_date || null,
      duration_label: emptyToNull(parsed.data.duration_label),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "contract_update", id);
  revalidatePath("/admin/crm/contracts");
  revalidatePath(`/admin/crm/contracts/${id}`);
  return { ok: true };
}

/** علامت‌گذاری به‌عنوان ارسال‌شده (بعد از کپی لینک برای کلاینت). */
export async function markContractSent(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("contracts")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "contract_send", id);
  revalidatePath("/admin/crm/contracts");
  revalidatePath(`/admin/crm/contracts/${id}`);
  return { ok: true };
}

export async function cancelContract(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("contracts")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "accepted");
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "contract_cancel", id);
  revalidatePath("/admin/crm/contracts");
  revalidatePath(`/admin/crm/contracts/${id}`);
  return { ok: true };
}

export async function deleteContract(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "contract_delete", id);
  revalidatePath("/admin/crm/contracts");
  return { ok: true };
}

/** بازنویسی متن قرارداد با AI بر اساس شناخت مشتری. */
export async function draftContractAI(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, title, body_md, amount_toman, duration_label, status, contact:contacts(full_name, ai_summary, lead_id), company:companies(name), deal:deals(title)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!contract) return { ok: false, error: "قرارداد پیدا نشد." };
  if (contract.status === "accepted") {
    return { ok: false, error: "قرارداد تأییدشده قابل بازنویسی نیست." };
  }

  const contact = contract.contact as unknown as {
    full_name: string;
    ai_summary: string | null;
    lead_id: string | null;
  } | null;
  const company = contract.company as unknown as { name: string } | null;
  const deal = contract.deal as unknown as { title: string } | null;

  let challenge: string | null = null;
  if (contact?.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("challenge")
      .eq("id", contact.lead_id)
      .maybeSingle();
    challenge = lead?.challenge ?? null;
  }

  const result = await draftContractBody({
    clientName: contact?.full_name ?? "کارفرما",
    companyName: company?.name ?? null,
    dealTitle: deal?.title ?? contract.title,
    amountToman: contract.amount_toman,
    durationLabel: contract.duration_label,
    challenge,
    aiSummary: contact?.ai_summary ?? null,
    currentBody: contract.body_md,
  });
  if (!result.ok || !result.body) return { ok: false, error: result.error };

  const { error } = await supabase
    .from("contracts")
    .update({ body_md: result.body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "ai_draft_contract", id);
  revalidatePath(`/admin/crm/contracts/${id}`);
  return { ok: true };
}

// ── کمپین‌های ایمیلی ─────────────────────────────────────────────

/** ساخت کمپین: سگمنت ساخته می‌شود و برای هر گیرنده یک ردیف ایمیل خالی ثبت می‌شود. */
export async function createCampaign(
  name: string,
  segmentKey: string,
  goal: string
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  if (!name.trim()) return { ok: false, error: "نام کمپین را وارد کنید." };
  if (!SEGMENTS[segmentKey]) return { ok: false, error: "سگمنت نامعتبر است." };
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const recipients = await buildSegment(segmentKey);
  if (recipients.length === 0) {
    return { ok: false, error: "این سگمنت گیرنده‌ای با ایمیل ندارد." };
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      name: name.trim(),
      segment_key: segmentKey,
      goal: goal.trim() || null,
      created_by: g.session.email,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: emailsError } = await supabase.from("campaign_emails").insert(
    recipients.map((r) => ({
      campaign_id: campaign.id,
      contact_id: r.contact_id,
      lead_id: r.lead_id,
      to_name: r.to_name,
      to_email: r.to_email,
      context: r.context,
    }))
  );
  if (emailsError) return { ok: false, error: emailsError.message };

  await logAudit(g.session, "campaign_create", campaign.id, {
    segment: segmentKey,
    recipients: recipients.length,
  });
  revalidatePath("/admin/crm/campaigns");
  return { ok: true, id: campaign.id };
}

/** تولید متن AI برای یک ایمیل کمپین (تک‌به‌تک تا timeout نخوریم). */
export async function generateCampaignEmailAI(emailId: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: row } = await supabase
    .from("campaign_emails")
    .select("id, to_name, context, status, campaign:campaigns(goal, status)")
    .eq("id", emailId)
    .maybeSingle();
  if (!row) return { ok: false, error: "ایمیل پیدا نشد." };
  const campaign = row.campaign as unknown as { goal: string | null; status: string } | null;
  if (campaign?.status === "sent") return { ok: false, error: "کمپین ارسال شده است." };

  const result = await generateCampaignEmail({
    toName: row.to_name,
    context: (row.context as Record<string, unknown>) ?? {},
    campaignGoal: campaign?.goal ?? null,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const { error } = await supabase
    .from("campaign_emails")
    .update({ subject: result.subject, body_text: result.body, status: "ready", error: null })
    .eq("id", emailId);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "ai_campaign_email", emailId);
  revalidatePath("/admin/crm/campaigns");
  return { ok: true };
}

export async function updateCampaignEmail(
  emailId: string,
  subject: string,
  body: string
): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  if (!subject.trim() || body.trim().length < 20) {
    return { ok: false, error: "موضوع و متن ایمیل را کامل کنید." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("campaign_emails")
    .update({ subject: subject.trim(), body_text: body.trim(), status: "ready" })
    .eq("id", emailId)
    .neq("status", "sent");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/crm/campaigns");
  return { ok: true };
}

export async function toggleCampaignEmailSkip(emailId: string, skip: boolean): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("campaign_emails")
    .update({ status: skip ? "skipped" : "pending" })
    .eq("id", emailId)
    .neq("status", "sent");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/crm/campaigns");
  return { ok: true };
}

/** ارسال کمپین با Resend — فقط ایمیل‌های آماده (ready). */
export async function sendCampaign(campaignId: string): Promise<ActionResult & { sent?: number; failed?: number }> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return {
      ok: false,
      error: "RESEND_API_KEY تنظیم نشده است. متن ایمیل‌ها را می‌توانید کپی و دستی ارسال کنید.",
    };
  }

  const { data: emails } = await supabase
    .from("campaign_emails")
    .select("id, to_name, to_email, subject, body_text")
    .eq("campaign_id", campaignId)
    .eq("status", "ready");
  if (!emails?.length) return { ok: false, error: "هیچ ایمیل آماده‌ای (ready) برای ارسال نیست." };

  const from = process.env.RESEND_FROM || "Arkan <onboarding@resend.dev>";
  let sent = 0;
  let failed = 0;
  for (const e of emails) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: e.to_email, subject: e.subject, text: e.body_text }),
      });
      if (res.ok) {
        sent++;
        await supabase
          .from("campaign_emails")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", e.id);
      } else {
        failed++;
        const detail = await res.text();
        await supabase
          .from("campaign_emails")
          .update({ status: "failed", error: detail.slice(0, 300) })
          .eq("id", e.id);
      }
    } catch (err) {
      failed++;
      await supabase
        .from("campaign_emails")
        .update({ status: "failed", error: (err as Error).message.slice(0, 300) })
        .eq("id", e.id);
    }
  }

  if (sent > 0) {
    await supabase
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
  }
  await logAudit(g.session, "campaign_send", campaignId, { sent, failed });
  revalidatePath("/admin/crm/campaigns");
  return { ok: sent > 0, sent, failed, error: sent === 0 ? "هیچ ایمیلی ارسال نشد." : undefined };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit(g.session, "campaign_delete", id);
  revalidatePath("/admin/crm/campaigns");
  return { ok: true };
}

// ── پیگیری هوشمند قرارداد ────────────────────────────────────────

export async function contractFollowupAI(
  contractId: string,
  shareUrl: string
): Promise<ActionResult & { text?: string }> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, title, contract_no, status, sent_at, viewed_at, contact:contacts(full_name), company:companies(name)")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { ok: false, error: "قرارداد پیدا نشد." };
  if (contract.status !== "sent" && contract.status !== "viewed") {
    return { ok: false, error: "پیگیری فقط برای قرارداد ارسال‌شده/دیده‌شده معنا دارد." };
  }

  const since = contract.viewed_at ?? contract.sent_at;
  const daysWaiting = since
    ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86400000))
    : 0;
  const contact = contract.contact as unknown as { full_name: string } | null;
  const company = contract.company as unknown as { name: string } | null;

  const result = await generateContractFollowup({
    clientName: contact?.full_name ?? "کارفرمای گرامی",
    companyName: company?.name ?? null,
    contractTitle: contract.title,
    contractNo: contract.contract_no,
    status: contract.status,
    daysWaiting,
    shareUrl,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await logAudit(g.session, "ai_contract_followup", contractId);
  return { ok: true, text: result.text };
}

// ── پیشنهاد محتوای بلاگ برای لید ─────────────────────────────────

export async function suggestContentAI(
  leadId: string
): Promise<ActionResult & { message?: string; url?: string; title?: string }> {
  const g = guard();
  if ("fail" in g) return g.fail;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_DB;

  const [{ data: lead }, posts] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name, business_name, challenge, contact_id")
      .eq("id", leadId)
      .maybeSingle(),
    listPublishedPosts(),
  ]);
  if (!lead) return { ok: false, error: "لید پیدا نشد." };

  const result = await suggestBlogContent({
    leadName: lead.full_name,
    business: lead.business_name,
    challenge: lead.challenge,
    posts: posts.slice(0, 20).map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      keywords: p.keywords,
    })),
  });
  if (!result.ok || !result.slug) return { ok: false, error: result.error };

  const post = posts.find((p) => p.slug === result.slug)!;
  const url = `https://arkan-website-chatbot.vercel.app/blog/${post.slug}`;

  // اگر لید به مخاطب تبدیل شده، پیشنهاد به‌عنوان یادداشت در تایم‌لاین ثبت شود
  if (lead.contact_id) {
    await supabase.from("activities").insert({
      contact_id: lead.contact_id,
      type: "note",
      title: `پیشنهاد محتوا: ${post.title}`,
      body: `${result.message}\n${url}`,
      created_by: g.session.email,
    });
  }

  await logAudit(g.session, "ai_blog_suggest", leadId, { slug: post.slug });
  return { ok: true, message: result.message, url, title: post.title };
}

// ── اکشن‌های AI ──────────────────────────────────────────────────

export async function scoreLeadAI(leadId: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;

  const result = await scoreLead(leadId);
  if (result.ok) {
    logAudit(g.session, "ai_score_lead", leadId);
    revalidatePath("/admin/leads");
  }
  return result;
}

export async function summarizeContactAI(contactId: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;

  const result = await summarizeConversation(contactId);
  if (result.ok) {
    logAudit(g.session, "ai_summarize_contact", contactId);
    revalidatePath(`/admin/crm/contacts/${contactId}`);
  }
  return result;
}

export async function nextBestActionAI(dealId: string): Promise<ActionResult> {
  const g = guard();
  if ("fail" in g) return g.fail;

  const result = await nextBestAction(dealId);
  if (result.ok) {
    logAudit(g.session, "ai_next_action", dealId);
    revalidatePath("/admin/crm/deals");
  }
  return result;
}
