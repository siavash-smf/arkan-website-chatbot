import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import Dashboard from "@/components/admin/Dashboard";
import { getAnalytics } from "@/lib/rag/analytics";

export const metadata: Metadata = {
  title: "داشبورد",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!isAuthed()) redirect("/admin/login");

  let data = null;
  let error: string | null = null;
  try {
    data = await getAnalytics();
    if (!data) error = "اتصال Supabase تنظیم نشده است.";
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <AdminShell active="dashboard">
      <Dashboard data={data} error={error} />
    </AdminShell>
  );
}
