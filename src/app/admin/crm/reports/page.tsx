import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCrmReport } from "@/lib/crm/reports";
import AdminShell from "@/components/admin/AdminShell";
import CrmReports from "@/components/admin/crm/CrmReports";

export const metadata: Metadata = { title: "گزارش‌های CRM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CrmReportsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const { data, error } = await getCrmReport();

  return (
    <AdminShell active="reports" role={session.role}>
      <CrmReports report={data} error={error} />
    </AdminShell>
  );
}
