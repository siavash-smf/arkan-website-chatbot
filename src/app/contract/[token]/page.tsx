import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContractByToken } from "@/lib/crm/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import Logo from "@/components/ui/Logo";
import type { ContractDocData } from "@/lib/crm/contract-blocks";
import ContractClientView from "./view";

export const metadata: Metadata = {
  title: "قرارداد — آرکان",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
// بعد از تأیید، ارسال نسخه‌ی تأییدشده با PDF پیوست از همین صفحه انجام می‌شود
export const maxDuration = 60;

export default async function PublicContractPage({ params }: { params: { token: string } }) {
  const contract = await getContractByToken(params.token);
  if (!contract) notFound();

  // نام و ایمیل کارفرما و شرکت برای سند
  const supabase = getSupabaseAdmin();
  let clientName = "";
  let clientEmail: string | null = null;
  let companyName: string | null = null;
  if (supabase) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("full_name, email, company:companies(name)")
      .eq("id", contract.contact_id)
      .maybeSingle();
    clientName = contact?.full_name ?? "";
    clientEmail = contact?.email ?? null;
    companyName = (contact?.company as unknown as { name: string } | null)?.name ?? null;
  }

  const doc: ContractDocData = {
    contractNo: contract.contract_no,
    title: contract.title,
    issuedAt: contract.created_at,
    clientName,
    companyName,
    clientEmail,
    amountToman: contract.amount_toman,
    durationLabel: contract.duration_label,
    startDate: contract.start_date,
    bodyMd: contract.body_md,
    acceptance:
      contract.status === "accepted" && contract.accepted_at
        ? {
            name: contract.accepted_by_name ?? clientName,
            at: contract.accepted_at,
            ip: contract.accepted_ip ?? null,
            code: contract.share_token.slice(0, 8),
          }
        : null,
  };

  return (
    <main className="min-h-dvh bg-bone py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-5">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <p className="text-caption text-slate">قرارداد خدمات مشاوره</p>
        </header>
        <ContractClientView
          token={params.token}
          doc={doc}
          status={contract.status}
          copySent={!!contract.accepted_copy_sent_at}
        />
      </div>
    </main>
  );
}
