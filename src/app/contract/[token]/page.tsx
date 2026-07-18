import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getContractByToken } from "@/lib/crm/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import Logo from "@/components/ui/Logo";
import { faNum, formatToman, toFa } from "@/lib/utils";
import ContractClientActions from "./view";

export const metadata: Metadata = {
  title: "قرارداد — آرکان",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function faDate(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(iso));
}

export default async function PublicContractPage({ params }: { params: { token: string } }) {
  const contract = await getContractByToken(params.token);
  if (!contract) notFound();

  // نام کارفرما/شرکت برای سربرگ
  const supabase = getSupabaseAdmin();
  let clientName = "";
  let companyName: string | null = null;
  if (supabase) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("full_name, company:companies(name)")
      .eq("id", contract.contact_id)
      .maybeSingle();
    clientName = contact?.full_name ?? "";
    companyName = (contact?.company as unknown as { name: string } | null)?.name ?? null;
  }

  const html = await marked.parse(contract.body_md);

  return (
    <main className="min-h-dvh bg-bone py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-5">
        {/* نوار اقدامات — در چاپ حذف می‌شود */}
        <ContractClientActions
          token={params.token}
          status={contract.status}
          acceptedByName={contract.accepted_by_name}
          acceptedAt={contract.accepted_at ? faDate(contract.accepted_at, true) : null}
        />

        {/* سند قرارداد */}
        <article className="rounded-card border border-sand bg-white p-8 shadow-soft-md print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10">
          {/* سربرگ برند */}
          <header className="border-b-2 border-pine pb-6">
            <div className="flex items-start justify-between gap-4">
              <Logo />
              <div className="text-left text-caption text-slate">
                <p dir="ltr" className="font-medium text-pine">
                  {contract.contract_no}
                </p>
                <p className="mt-1">تاریخ تنظیم: {faDate(contract.created_at)}</p>
              </div>
            </div>
            <h1 className="mt-6 font-heading text-h2 font-bold text-pine">{contract.title}</h1>
            <div className="mt-4 grid gap-x-8 gap-y-1.5 text-[0.95rem] sm:grid-cols-2">
              <p>
                <span className="text-slate">کارفرما: </span>
                <span className="font-medium text-ink">
                  {companyName ? `${companyName} — ${clientName}` : clientName}
                </span>
              </p>
              <p>
                <span className="text-slate">مشاور: </span>
                <span className="font-medium text-ink">شرکت مشاوره‌ی مدیریت آرکان</span>
              </p>
              {contract.amount_toman > 0 && (
                <p>
                  <span className="text-slate">مبلغ قرارداد: </span>
                  <span className="font-medium text-brass-dark">{formatToman(contract.amount_toman)}</span>
                </p>
              )}
              {contract.duration_label && (
                <p>
                  <span className="text-slate">مدت: </span>
                  <span className="font-medium text-ink">{contract.duration_label}</span>
                </p>
              )}
              {contract.start_date && (
                <p>
                  <span className="text-slate">تاریخ شروع: </span>
                  <span className="font-medium text-ink">{faDate(contract.start_date)}</span>
                </p>
              )}
            </div>
          </header>

          {/* متن قرارداد */}
          <div className="prose-arkan mt-8" dangerouslySetInnerHTML={{ __html: html }} />

          {/* امضاها */}
          <footer className="mt-12 border-t border-sand pt-8">
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="text-caption text-slate">مشاور</p>
                <p className="mt-1 font-medium text-ink">شرکت مشاوره‌ی مدیریت آرکان</p>
                <div className="mt-6 h-14 border-b border-dashed border-slate/40" aria-hidden="true" />
                <p className="mt-1.5 text-[0.75rem] text-slate">مهر و امضا</p>
              </div>
              <div>
                <p className="text-caption text-slate">کارفرما</p>
                <p className="mt-1 font-medium text-ink">
                  {companyName ? `${companyName} — ${clientName}` : clientName}
                </p>
                {contract.status === "accepted" && contract.accepted_at ? (
                  <div className="mt-4 rounded-card border border-green-200 bg-green-50 px-4 py-3 print:border print:border-green-300">
                    <p className="text-[0.9rem] font-medium text-green-700">
                      ✓ تأیید آنلاین توسط {contract.accepted_by_name}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-green-700/80">
                      {faDate(contract.accepted_at, true)} · کد پیگیری:{" "}
                      <span dir="ltr">{toFa(contract.share_token.slice(0, 8))}</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 h-14 border-b border-dashed border-slate/40" aria-hidden="true" />
                    <p className="mt-1.5 text-[0.75rem] text-slate">مهر و امضا / تأیید آنلاین</p>
                  </>
                )}
              </div>
            </div>
            <p className="mt-10 text-center text-[0.75rem] leading-6 text-slate">
              شرکت مشاوره‌ی مدیریت آرکان — مشاور استراتژی و رشد کسب‌وکار · تهران
              <br />
              این سند از طریق لینک اختصاصی و امن برای کارفرما ارسال شده است.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}
