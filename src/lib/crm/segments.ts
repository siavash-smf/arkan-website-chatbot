import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * سگمنت‌های کمپین — تعریف‌شده در کد (قابل ارائه به‌عنوان الگوی segment builder).
 * هر سگمنت گیرنده‌هایی با ایمیل + زمینه‌ی شخصی‌سازی برای AI برمی‌گرداند.
 * سقف ۲۰ گیرنده در هر کمپین تا تولید AI و ارسال قابل مدیریت بماند.
 */

export type CampaignRecipient = {
  contact_id: string | null;
  lead_id: string | null;
  to_name: string;
  to_email: string;
  context: Record<string, unknown>;
};

export const SEGMENTS: Record<string, { label: string; description: string }> = {
  lost_leads: {
    label: "لیدهای ازدست‌رفته",
    description: "لیدهایی با وضعیت «منصرف» — برای کمپین بازگشت (win-back).",
  },
  stale_new_leads: {
    label: "لیدهای پیگیری‌نشده",
    description: "لیدهای «جدید» قدیمی‌تر از ۷ روز که هنوز تبدیل/پیگیری نشده‌اند.",
  },
  lost_deals: {
    label: "معاملات باخته",
    description: "مخاطبانی که معامله‌شان ناموفق بسته شد — برای احیای رابطه.",
  },
  won_clients: {
    label: "مشتریان موفق",
    description: "مخاطبانی با معامله‌ی برنده — برای قدردانی و فروش مکمل.",
  },
};

const LIMIT = 20;

export async function buildSegment(segmentKey: string): Promise<CampaignRecipient[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  switch (segmentKey) {
    case "lost_leads": {
      const { data } = await supabase
        .from("leads")
        .select("id, full_name, email, business_name, industry, challenge")
        .eq("status", "lost")
        .not("email", "is", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      return (data ?? []).map((l) => ({
        contact_id: null,
        lead_id: l.id,
        to_name: l.full_name,
        to_email: l.email!,
        context: { نوع: "لید ازدست‌رفته", کسب‌وکار: l.business_name, حوزه: l.industry, چالش: l.challenge },
      }));
    }
    case "stale_new_leads": {
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("leads")
        .select("id, full_name, email, business_name, industry, challenge")
        .eq("status", "new")
        .is("converted_at", null)
        .not("email", "is", null)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      return (data ?? []).map((l) => ({
        contact_id: null,
        lead_id: l.id,
        to_name: l.full_name,
        to_email: l.email!,
        context: { نوع: "لید پیگیری‌نشده", کسب‌وکار: l.business_name, حوزه: l.industry, چالش: l.challenge },
      }));
    }
    case "lost_deals":
    case "won_clients": {
      const status = segmentKey === "lost_deals" ? "lost" : "won";
      const { data } = await supabase
        .from("deals")
        .select("id, title, amount_toman, lost_reason, contact:contacts(id, full_name, email, company:companies(name))")
        .eq("status", status)
        .order("updated_at", { ascending: false })
        .limit(LIMIT * 2);
      const seen = new Set<string>();
      const out: CampaignRecipient[] = [];
      for (const d of data ?? []) {
        const contact = d.contact as unknown as {
          id: string;
          full_name: string;
          email: string | null;
          company: { name: string } | null;
        } | null;
        if (!contact?.email || seen.has(contact.id)) continue;
        seen.add(contact.id);
        out.push({
          contact_id: contact.id,
          lead_id: null,
          to_name: contact.full_name,
          to_email: contact.email,
          context: {
            نوع: status === "lost" ? "معامله‌ی باخته" : "مشتری موفق",
            شرکت: contact.company?.name,
            معامله: d.title,
            ...(status === "lost" ? { دلیل_باخت: d.lost_reason } : {}),
          },
        });
        if (out.length >= LIMIT) break;
      }
      return out;
    }
    default:
      return [];
  }
}
