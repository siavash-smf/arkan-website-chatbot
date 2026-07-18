import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getCompanies } from "@/lib/crm/queries";
import AdminShell from "@/components/admin/AdminShell";
import CompaniesManager from "@/components/admin/crm/CompaniesManager";

export const metadata: Metadata = { title: "شرکت‌ها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const { data: companies, error } = await getCompanies();

  return (
    <AdminShell active="companies" role={session.role}>
      <CompaniesManager companies={companies} error={error} canEdit={canWrite(session)} />
    </AdminShell>
  );
}
