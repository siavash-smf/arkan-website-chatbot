import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import LeadsManager, { type Lead } from "@/components/admin/LeadsManager";

export const metadata: Metadata = { title: "لیدها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// اکشن «امتیازدهی با AI» از همین صفحه صدا زده می‌شود؛ reasoning مدل زمان می‌برد.
export const maxDuration = 60;

export default async function LeadsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  let leads: Lead[] = [];
  let error: string | null = null;
  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است.";
  } else {
    const { data, error: dbError } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (dbError) error = dbError.message;
    else leads = (data as Lead[]) ?? [];
  }

  return (
    <AdminShell active="leads" role={session.role}>
      <LeadsManager leads={leads} error={error} />
    </AdminShell>
  );
}
