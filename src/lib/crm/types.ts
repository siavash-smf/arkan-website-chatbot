/**
 * تایپ‌ها و لیبل‌های فارسی ماژول CRM.
 * جریان کلاسیک: لید ← تبدیل ← مخاطب/شرکت/معامله؛ فعالیت‌ها روی مخاطب/معامله.
 */

export type Company = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  city: string | null;
  size_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactSource = "website" | "chatbot" | "manual";

export type Contact = {
  id: string;
  company_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  source: ContactSource;
  lead_id: string | null;
  conversation_id: string | null;
  ai_summary: string | null;
  ai_summary_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactWithCompany = Contact & {
  company: Pick<Company, "id" | "name"> | null;
};

export type PipelineStage = {
  key: string;
  label_fa: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
};

export type DealStatus = "open" | "won" | "lost";

export type Deal = {
  id: string;
  title: string;
  contact_id: string;
  company_id: string | null;
  stage_key: string;
  status: DealStatus;
  amount_toman: number;
  expected_close: string | null;
  stage_entered_at: string;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  owner_email: string | null;
  ai_next_action: string | null;
  ai_next_action_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DealWithContact = Deal & {
  contact: Pick<Contact, "id" | "full_name"> | null;
};

export type ActivityType = "call" | "meeting" | "note" | "task" | "stage_change";

export type Activity = {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  type: ActivityType;
  title: string;
  body: string | null;
  due_at: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type ActivityWithRefs = Activity & {
  contact: Pick<Contact, "id" | "full_name"> | null;
  deal: Pick<Deal, "id" | "title"> | null;
};

export const ACTIVITY_TYPE_META: Record<ActivityType, { label: string; icon: string }> = {
  call: { label: "تماس", icon: "📞" },
  meeting: { label: "جلسه", icon: "🤝" },
  note: { label: "یادداشت", icon: "📝" },
  task: { label: "وظیفه", icon: "✅" },
  stage_change: { label: "تغییر مرحله", icon: "🔀" },
};

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  website: "وب‌سایت",
  chatbot: "چت‌بات",
  manual: "دستی",
};

export const DEAL_STATUS_META: Record<DealStatus, { label: string; className: string }> = {
  open: { label: "باز", className: "bg-brass/15 text-brass-dark" },
  won: { label: "موفق", className: "bg-green-100 text-green-700" },
  lost: { label: "ناموفق", className: "bg-slate/15 text-slate" },
};

export type ContractStatus = "draft" | "sent" | "viewed" | "accepted" | "canceled";

export type Contract = {
  id: string;
  contract_no: string;
  title: string;
  deal_id: string | null;
  contact_id: string;
  company_id: string | null;
  body_md: string;
  amount_toman: number;
  start_date: string | null;
  duration_label: string | null;
  status: ContractStatus;
  share_token: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  /** ستون‌های proposals-schema.sql — روی دیتابیسی که آن را اجرا نکرده undefined هستند */
  accepted_ip?: string | null;
  accepted_copy_sent_at?: string | null;
  proposal_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractWithRefs = Contract & {
  contact: Pick<Contact, "id" | "full_name" | "email"> | null;
  company: Pick<Company, "id" | "name"> | null;
};

export const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: "پیش‌نویس", className: "bg-sand text-ink" },
  sent: { label: "ارسال‌شده", className: "bg-brass/15 text-brass-dark" },
  viewed: { label: "دیده‌شده", className: "bg-blue-100 text-blue-700" },
  accepted: { label: "تأییدشده", className: "bg-green-100 text-green-700" },
  canceled: { label: "لغوشده", className: "bg-slate/15 text-slate" },
};
