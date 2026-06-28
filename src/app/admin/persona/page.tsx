import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminShell from "@/components/admin/AdminShell";
import PersonaEditor, { type PromptVersion } from "@/components/admin/PersonaEditor";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/rag/config";

export const metadata: Metadata = { title: "پرسونا", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PersonaPage() {
  if (!isAuthed()) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  let versions: PromptVersion[] = [];
  let error: string | null = null;
  if (!supabase) {
    error = "اتصال Supabase تنظیم نشده است.";
  } else {
    const { data, error: e } = await supabase
      .from("prompt_versions")
      .select("id, content, persona, is_active, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (e) error = e.message;
    else versions = (data as PromptVersion[]) ?? [];
  }

  return (
    <AdminShell active="persona">
      <PersonaEditor versions={versions} error={error} defaultPrompt={DEFAULT_SYSTEM_PROMPT} />
    </AdminShell>
  );
}
