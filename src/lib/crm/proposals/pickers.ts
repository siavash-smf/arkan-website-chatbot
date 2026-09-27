import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ContactOption, DealOption } from "@/components/admin/crm/ProposalComposer";

/** فهرست مخاطبان و معاملات باز برای انتخاب در فرم پروپوزال. */
export async function getComposerPickers(): Promise<{ contacts: ContactOption[]; deals: DealOption[] }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { contacts: [], deals: [] };
  const [{ data: contacts }, { data: deals }] = await Promise.all([
    supabase.from("contacts").select("id, full_name, email, phone, company:companies(name)").order("full_name"),
    supabase
      .from("deals")
      .select("id, title, contact_id, amount_toman")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);
  return {
    contacts: (contacts as unknown as ContactOption[]) ?? [],
    deals: (deals as DealOption[]) ?? [],
  };
}
