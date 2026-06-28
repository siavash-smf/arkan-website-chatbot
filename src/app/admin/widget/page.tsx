import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import WidgetSettings from "@/components/admin/WidgetSettings";
import { getWidgetConfig } from "@/lib/rag/widget";

export const metadata: Metadata = { title: "ویجت", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const SITE_URL = "https://arkan-website-chatbot.vercel.app";

export default async function WidgetAdminPage() {
  if (!isAuthed()) redirect("/admin/login");
  const cfg = await getWidgetConfig();
  return (
    <AdminShell active="widget">
      <WidgetSettings config={cfg} siteUrl={SITE_URL} />
    </AdminShell>
  );
}
