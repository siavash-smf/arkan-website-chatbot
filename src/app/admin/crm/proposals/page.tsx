import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { getProposals } from "@/lib/crm/proposals/queries";
import AdminShell from "@/components/admin/AdminShell";
import ProposalsManager from "@/components/admin/crm/ProposalsManager";

export const metadata: Metadata = { title: "پروپوزال‌ها", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const { data: proposals, error } = await getProposals();

  return (
    <AdminShell active="proposals" role={session.role}>
      <ProposalsManager proposals={proposals} error={error} canEdit={canWrite(session)} />
    </AdminShell>
  );
}
