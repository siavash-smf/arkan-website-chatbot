import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import ModelSettings from "@/components/admin/ModelSettings";
import { getModelConfig, getEmbeddingConfig } from "@/lib/rag/config";

export const metadata: Metadata = { title: "مدل‌ها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  if (!isAuthed()) redirect("/admin/login");
  const [model, embedding] = await Promise.all([getModelConfig("web"), getEmbeddingConfig()]);
  return (
    <AdminShell active="models">
      <ModelSettings model={model} embedding={embedding} />
    </AdminShell>
  );
}
