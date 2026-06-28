import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import LeadsManager, { type Lead } from "@/components/admin/LeadsManager";

export const metadata: Metadata = {
  title: "پنل مدیریت",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthed()) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  let leads: Lead[] = [];
  let error: string | null = null;

  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است. متغیرهای محیطی را بررسی کنید.";
  } else {
    const { data, error: dbError } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (dbError) error = dbError.message;
    else leads = (data as Lead[]) ?? [];
  }

  return (
    <AdminShell active="leads">
      <LeadsManager leads={leads} error={error} />
    </AdminShell>
  );
}
