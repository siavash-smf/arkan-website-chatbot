import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import TelegramSettings from "@/components/admin/TelegramSettings";

export const metadata: Metadata = { title: "تلگرام", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  let userCount = 0;
  if (supabase) {
    const { count } = await supabase
      .from("unified_users")
      .select("id", { count: "exact", head: true })
      .eq("channel", "telegram");
    userCount = count ?? 0;
  }
  return (
    <AdminShell active="telegram" role={session.role}>
      <TelegramSettings userCount={userCount} />
    </AdminShell>
  );
}
