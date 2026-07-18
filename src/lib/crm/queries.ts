import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  Activity,
  ActivityWithRefs,
  Company,
  Contact,
  ContactWithCompany,
  Contract,
  ContractWithRefs,
  Deal,
  DealWithContact,
  PipelineStage,
} from "@/lib/crm/types";

/**
 * کوئری‌های خواندنی CRM برای صفحات پنل.
 * الگوی خروجی { data, error } مثل بقیه‌ی صفحات ادمین.
 */

type Result<T> = { data: T; error: string | null };

const NO_DB = "اتصال Supabase تنظیم نشده است.";

export async function getStages(): Promise<Result<PipelineStage[]>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: [], error: NO_DB };
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position");
  return { data: (data as PipelineStage[]) ?? [], error: error?.message ?? null };
}

export async function getContacts(): Promise<Result<ContactWithCompany[]>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: [], error: NO_DB };
  const { data, error } = await supabase
    .from("contacts")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false });
  return { data: (data as unknown as ContactWithCompany[]) ?? [], error: error?.message ?? null };
}

export async function getCompanies(): Promise<
  Result<Array<Company & { contact_count: number; deal_count: number }>>
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: [], error: NO_DB };
  const { data, error } = await supabase
    .from("companies")
    .select("*, contacts(count), deals(count)")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = ((data as unknown as Array<
    Company & { contacts: Array<{ count: number }>; deals: Array<{ count: number }> }
  >) ?? []).map(({ contacts, deals, ...company }) => ({
    ...company,
    contact_count: contacts?.[0]?.count ?? 0,
    deal_count: deals?.[0]?.count ?? 0,
  }));
  return { data: rows, error: null };
}

export async function getDealsBoard(): Promise<
  Result<{ stages: PipelineStage[]; deals: DealWithContact[] }>
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: { stages: [], deals: [] }, error: NO_DB };
  const [stagesRes, dealsRes] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("position"),
    supabase
      .from("deals")
      .select("*, contact:contacts(id, full_name)")
      .order("created_at", { ascending: false }),
  ]);
  const error = stagesRes.error?.message ?? dealsRes.error?.message ?? null;
  return {
    data: {
      stages: (stagesRes.data as PipelineStage[]) ?? [],
      deals: (dealsRes.data as unknown as DealWithContact[]) ?? [],
    },
    error,
  };
}

export async function getActivities(): Promise<Result<ActivityWithRefs[]>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: [], error: NO_DB };
  const { data, error } = await supabase
    .from("activities")
    .select("*, contact:contacts(id, full_name), deal:deals(id, title)")
    .order("created_at", { ascending: false })
    .limit(300);
  return { data: (data as unknown as ActivityWithRefs[]) ?? [], error: error?.message ?? null };
}

export async function getContracts(): Promise<Result<ContractWithRefs[]>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: [], error: NO_DB };
  const { data, error } = await supabase
    .from("contracts")
    .select("*, contact:contacts(id, full_name, email), company:companies(id, name)")
    .order("created_at", { ascending: false });
  return { data: (data as unknown as ContractWithRefs[]) ?? [], error: error?.message ?? null };
}

export async function getContract(id: string): Promise<Result<ContractWithRefs | null>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: null, error: NO_DB };
  const { data, error } = await supabase
    .from("contracts")
    .select("*, contact:contacts(id, full_name, email), company:companies(id, name)")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as unknown as ContractWithRefs) ?? null, error: error?.message ?? null };
}

/**
 * قرارداد از روی توکن اشتراک (صفحه‌ی عمومی کلاینت).
 * اولین بازدیدِ قراردادِ ارسال‌شده، viewed_at را ثبت می‌کند.
 */
export async function getContractByToken(token: string): Promise<Contract | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("share_token", token)
    .maybeSingle<Contract>();
  if (!data) return null;

  if (data.status === "sent" && !data.viewed_at) {
    const viewedAt = new Date().toISOString();
    await supabase
      .from("contracts")
      .update({ status: "viewed", viewed_at: viewedAt })
      .eq("id", data.id);
    return { ...data, status: "viewed", viewed_at: viewedAt };
  }
  return data;
}

/** تعداد وظایف معوق (برای کارت داشبورد). */
export async function getOverdueTaskCount(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .is("done_at", null)
    .lt("due_at", new Date().toISOString());
  return count ?? 0;
}

// ── نمای ۳۶۰ درجه‌ی مخاطب ────────────────────────────────────────

export type SourceLead = {
  id: string;
  created_at: string;
  stage: string;
  challenge: string;
  preferred_time: string | null;
  ai_score: number | null;
  ai_score_rationale: string | null;
};

export type ConversationPreview = {
  id: string;
  channel: string;
  started_at: string;
  messages: Array<{ role: string; content: string; created_at: string }>;
};

export type Contact360 = {
  contact: Contact;
  company: Company | null;
  deals: Deal[];
  activities: Activity[];
  lead: SourceLead | null;
  conversation: ConversationPreview | null;
};

export async function getContact360(id: string): Promise<Result<Contact360 | null>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { data: null, error: NO_DB };

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle<Contact>();
  if (contactError) return { data: null, error: contactError.message };
  if (!contact) return { data: null, error: null };

  const [companyRes, dealsRes, activitiesRes, leadRes, convRes, messagesRes] = await Promise.all([
    contact.company_id
      ? supabase.from("companies").select("*").eq("id", contact.company_id).maybeSingle<Company>()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("deals")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    contact.lead_id
      ? supabase
          .from("leads")
          .select("id, created_at, stage, challenge, preferred_time, ai_score, ai_score_rationale")
          .eq("id", contact.lead_id)
          .maybeSingle<SourceLead>()
      : Promise.resolve({ data: null, error: null }),
    contact.conversation_id
      ? supabase
          .from("conversations")
          .select("id, channel, started_at")
          .eq("id", contact.conversation_id)
          .maybeSingle<{ id: string; channel: string; started_at: string }>()
      : Promise.resolve({ data: null, error: null }),
    // conversation_id از خود contact معلوم است؛ پیام‌ها هم در همین batch می‌آیند
    contact.conversation_id
      ? supabase
          .from("messages")
          .select("role, content, created_at")
          .eq("conversation_id", contact.conversation_id)
          .in("role", ["user", "assistant"])
          .order("created_at")
          .limit(50)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const conversation: ConversationPreview | null = convRes.data
    ? { ...convRes.data, messages: messagesRes.data ?? [] }
    : null;

  return {
    data: {
      contact,
      company: companyRes.data,
      deals: (dealsRes.data as Deal[]) ?? [],
      activities: (activitiesRes.data as Activity[]) ?? [],
      lead: leadRes.data,
      conversation,
    },
    error: null,
  };
}
