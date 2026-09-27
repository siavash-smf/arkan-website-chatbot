/**
 * تایپ‌های پروپوزال (پیشنهاد همکاری).
 * «ProposalData» تنها منبع حقیقت برای رندر سند است: همان داده هم پیش‌نمایش ادمین را
 * می‌سازد، هم صفحه‌ی عمومی کلاینت و هم PDF را.
 */

/** یک بسته‌ی همکاری که کلاینت از بین آن‌ها انتخاب می‌کند. یک بسته ⇒ فقط یک مبلغ. */
export type ProposalOption = {
  /** شناسه‌ی پایدار برای ثبت انتخاب کلاینت */
  id: string;
  name: string;
  /** یک خط جایگاه‌یابی، مثل «برای شروع با کم‌ترین ریسک» */
  tagline?: string | null;
  /** به تومان */
  price: number;
  /** با برچسب «پیشنهاد ما» برجسته می‌شود */
  recommended?: boolean;
  features: string[];
  /** مثل «۴۰٪ پیش‌پرداخت، ۶۰٪ در دو قسط» */
  paymentNote?: string | null;
  /** مثل «۱۲ هفته» */
  durationNote?: string | null;
};

export type ProposalPhase = {
  title: string;
  detail?: string | null;
  /** مثل «هفته ۱ تا ۳» */
  duration?: string | null;
};

export type ProposalData = {
  proposalNo: string;
  issuedAt: string; // ISO
  revision: number;

  clientName: string;
  clientEmail: string;
  clientCompany?: string | null;
  clientPhone?: string | null;

  title: string;
  intro?: string | null;
  understanding: string[];
  goals: string[];
  phases: ProposalPhase[];
  deliverables: string[];
  methodology?: string | null;
  timelineNote?: string | null;
  exclusions: string[];
  assumptions: string[];
  whyUs: string[];
  nextSteps: string[];
  termsNote?: string | null;

  options: ProposalOption[];
  validUntil?: string | null;
};

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "changes_requested"
  | "declined"
  | "converted"
  | "canceled";

export type ProposalComment = {
  id: string;
  author: "client" | "admin";
  body: string;
  revision: number;
  created_at: string;
};

/** ردیف جدول arkan.proposals همان‌طور که از Supabase می‌آید (snake_case). */
export type ProposalRecord = {
  id: string;
  proposal_no: string;
  contact_id: string | null;
  deal_id: string | null;
  client_name: string;
  client_email: string;
  client_company: string | null;
  client_phone: string | null;
  title: string;
  intro: string | null;
  understanding: string[];
  goals: string[];
  phases: ProposalPhase[];
  deliverables: string[];
  methodology: string | null;
  timeline_note: string | null;
  exclusions: string[];
  assumptions: string[];
  why_us: string[];
  next_steps: string[];
  terms_note: string | null;
  options: ProposalOption[];
  valid_until: string | null;
  status: ProposalStatus;
  view_token: string;
  revision: number;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  responded_at: string | null;
  selected_option: string | null;
  responder_name: string | null;
  contract_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; className: string }> = {
  draft: { label: "پیش‌نویس", className: "bg-sand text-ink" },
  sent: { label: "ارسال‌شده", className: "bg-brass/15 text-brass-dark" },
  viewed: { label: "دیده‌شده", className: "bg-blue-100 text-blue-700" },
  approved: { label: "تأییدشده", className: "bg-green-100 text-green-700" },
  changes_requested: { label: "درخواست تغییر", className: "bg-amber-100 text-amber-800" },
  declined: { label: "ردشده", className: "bg-slate/15 text-slate" },
  converted: { label: "تبدیل به قرارداد", className: "bg-pine/10 text-pine" },
  canceled: { label: "لغوشده", className: "bg-slate/15 text-slate" },
};

/** تبدیل ردیف دیتابیس به داده‌ی سند. */
export function recordToProposalData(row: ProposalRecord): ProposalData {
  return {
    proposalNo: row.proposal_no,
    issuedAt: row.sent_at ?? row.created_at,
    revision: row.revision ?? 1,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientCompany: row.client_company,
    clientPhone: row.client_phone,
    title: row.title,
    intro: row.intro,
    understanding: row.understanding ?? [],
    goals: row.goals ?? [],
    phases: row.phases ?? [],
    deliverables: row.deliverables ?? [],
    methodology: row.methodology,
    timelineNote: row.timeline_note,
    exclusions: row.exclusions ?? [],
    assumptions: row.assumptions ?? [],
    whyUs: row.why_us ?? [],
    nextSteps: row.next_steps ?? [],
    termsNote: row.terms_note,
    options: row.options ?? [],
    validUntil: row.valid_until,
  };
}

/** بسته‌ای که مبنای قرارداد می‌شود: انتخاب کلاینت، وگرنه «پیشنهاد ما»، وگرنه اولی. */
export function pickOption(
  options: ProposalOption[],
  selectedId: string | null | undefined
): ProposalOption | null {
  return (
    options.find((o) => o.id === selectedId) ??
    options.find((o) => o.recommended) ??
    options[0] ??
    null
  );
}

/** نسخه‌ای که این بار ارسال می‌شود: اولین ارسال همان نسخه‌ی ۱، هر ارسال دوباره یک نسخه جلوتر.
 *  هم مرورگر (برای چاپ شماره‌ی نسخه روی PDF) و هم سرور از همین تابع استفاده می‌کنند. */
export function sendRevision(record: Pick<ProposalRecord, "sent_at" | "revision">): number {
  return record.sent_at ? record.revision + 1 : record.revision;
}
