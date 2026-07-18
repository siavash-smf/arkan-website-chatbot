import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import Dashboard from "@/components/admin/Dashboard";
import { getAnalytics } from "@/lib/rag/analytics";
import { getOverdueTaskCount } from "@/lib/crm/queries";

export const metadata: Metadata = {
  title: "داشبورد",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  let data = null;
  let error: string | null = null;
  let overdueTasks = 0;
  try {
    [data, overdueTasks] = await Promise.all([getAnalytics(), getOverdueTaskCount()]);
    if (!data) error = "اتصال Supabase تنظیم نشده است.";
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <AdminShell active="dashboard" role={session.role}>
      <Dashboard data={data} error={error} overdueTasks={overdueTasks} />
    </AdminShell>
  );
}
