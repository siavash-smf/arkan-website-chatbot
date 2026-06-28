import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import ConversationsViewer, { type ConvRow } from "@/components/admin/ConversationsViewer";

export const metadata: Metadata = { title: "گفتگوها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  if (!isAuthed()) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  let conversations: ConvRow[] = [];
  let error: string | null = null;
  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است.";
  } else {
    const { data, error: e } = await supabase
      .from("conversations")
      .select("id, channel, status, started_at, last_at")
      .order("last_at", { ascending: false })
      .limit(50);
    if (e) error = e.message;
    else conversations = (data as ConvRow[]) ?? [];
  }

  return (
    <AdminShell active="conversations">
      <ConversationsViewer conversations={conversations} error={error} />
    </AdminShell>
  );
}
