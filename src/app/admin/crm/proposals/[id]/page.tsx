import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSession } from "@/lib/auth";
import { siteOrigin } from "@/lib/crm/doc-utils";
import { getProposal } from "@/lib/crm/proposals/queries";
import { getComposerPickers } from "@/lib/crm/proposals/pickers";
import AdminShell from "@/components/admin/AdminShell";
import ProposalComposer from "@/components/admin/crm/ProposalComposer";
import ProposalPanel from "@/components/admin/crm/ProposalPanel";

export const metadata: Metadata = { title: "پروپوزال", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// ارسال ایمیل با PDF پیوست از همین صفحه انجام می‌شود
export const maxDuration = 60;

export default async function ProposalPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) redirect("/admin/login");

  const [{ data, error }, { contacts, deals }] = await Promise.all([getProposal(params.id), getComposerPickers()]);
  if (error) {
    return (
      <AdminShell active="proposals" role={session.role}>
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">{error}</div>
      </AdminShell>
    );
  }
  if (!data) notFound();

  const canEdit = canWrite(session);
  return (
    <AdminShell active="proposals" role={session.role}>
      <ProposalPanel
        record={data.record}
        comments={data.comments}
        shareUrl={`${siteOrigin()}/proposal/${data.record.view_token}`}
        canEdit={canEdit}
      />
      <ProposalComposer
        record={data.record}
        contacts={contacts}
        deals={deals}
        locked={!canEdit || data.record.status === "converted"}
      />
    </AdminShell>
  );
}
