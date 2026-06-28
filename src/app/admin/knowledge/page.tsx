import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import KnowledgeManager, { type DocRow } from "@/components/admin/KnowledgeManager";

export const metadata: Metadata = { title: "پایگاه دانش", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// آپلود + embedding ممکن است چند ثانیه طول بکشد
export const maxDuration = 60;

export default async function KnowledgePage() {
  if (!isAuthed()) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  let docs: DocRow[] = [];
  let error: string | null = null;
  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است.";
  } else {
    const { data, error: e } = await supabase
      .from("documents")
      .select("id, title, source_type, source_url, status, chunk_count, error, tags, created_at")
      .order("created_at", { ascending: false });
    if (e) error = e.message;
    else docs = (data as DocRow[]) ?? [];
  }

  return (
    <AdminShell active="knowledge">
      <KnowledgeManager docs={docs} error={error} />
    </AdminShell>
  );
}
