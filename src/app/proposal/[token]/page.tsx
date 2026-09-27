import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProposalByToken, getProposalComments } from "@/lib/crm/proposals/queries";
import { recordToProposalData } from "@/lib/crm/proposals/types";
import Logo from "@/components/ui/Logo";
import ProposalClientView from "./view";

export const metadata: Metadata = {
  title: "پیشنهاد همکاری",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** صفحه‌ی عمومی پروپوزال برای کلاینت — بدون ورود، با لینک توکن‌دار. */
export default async function PublicProposalPage({ params }: { params: { token: string } }) {
  const record = await getProposalByToken(params.token);
  if (!record) notFound();
  const comments = await getProposalComments(record.id);

  return (
    <main className="min-h-dvh bg-bone py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-5">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <p className="text-caption text-slate">پیشنهاد همکاری</p>
        </header>
        <ProposalClientView
          token={params.token}
          data={recordToProposalData(record)}
          status={record.status}
          selectedOption={record.selected_option}
          responderName={record.responder_name}
          respondedAt={record.responded_at}
          comments={comments}
        />
      </div>
    </main>
  );
}
