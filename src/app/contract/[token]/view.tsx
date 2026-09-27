"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptContract, deliverAcceptedContract } from "@/app/contract/actions";
import DocViewer, { type DocViewerHandle } from "@/components/documents/DocViewer";
import ContractSheets from "@/components/documents/ContractSheets";
import { blobToBase64, downloadBlob, renderSheetsToPdf } from "@/lib/documents/pdf";
import { faDateTime } from "@/lib/documents/format";
import type { ContractDocData } from "@/lib/crm/contract-blocks";
import type { ContractStatus } from "@/lib/crm/types";

/**
 * نمای کلاینت قرارداد: سند A4، دانلود PDF و فرم «تأیید قرارداد» آنلاین.
 * پس از تأیید، نسخه‌ی تأییدشده (با نام، زمان و IP روی صفحه‌ی امضا) خودکار
 * برای کلاینت و تیم آرکان ایمیل می‌شود.
 */
export default function ContractClientView({
  token,
  doc,
  status,
  copySent,
}: {
  token: string;
  doc: ContractDocData;
  status: ContractStatus;
  copySent: boolean;
}) {
  const router = useRouter();
  const [showAccept, setShowAccept] = useState(false);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [delivery, setDelivery] = useState<"idle" | "sending" | "sent">(copySent ? "sent" : "idle");
  const [pending, startTransition] = useTransition();

  const sheetsRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DocViewerHandle | null>(null);
  const deliveryStarted = useRef(false);

  const makePdf = useCallback(async () => {
    const root = sheetsRef.current;
    if (!root) throw new Error("سند آماده نیست.");
    const capture = () => renderSheetsToPdf(root, { title: `قرارداد ${doc.contractNo}`, subject: doc.title });
    return viewerRef.current ? viewerRef.current.atFullScale(capture) : capture();
  }, [doc.contractNo, doc.title]);

  async function download() {
    setDownloading(true);
    try {
      downloadBlob(await makePdf(), `${doc.contractNo}.pdf`);
    } catch (e) {
      setError((e as Error).message || "ساخت PDF ناموفق بود.");
    } finally {
      setDownloading(false);
    }
  }

  // قرارداد تأییدشده‌ای که نسخه‌اش هنوز فرستاده نشده: وقتی صفحه‌ها چیده شد، یک بار بفرست
  const handleReady = useCallback(() => {
    if (status !== "accepted" || copySent || deliveryStarted.current) return;
    deliveryStarted.current = true;
    setDelivery("sending");
    void (async () => {
      try {
        const res = await deliverAcceptedContract(token, await blobToBase64(await makePdf()));
        setDelivery(res.ok ? "sent" : "idle");
      } catch {
        setDelivery("idle");
      }
    })();
  }, [status, copySent, token, makePdf]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await acceptContract(token, name);
      if (res.ok) {
        setShowAccept(false);
        router.refresh(); // صفحه با امضای ثبت‌شده دوباره رندر می‌شود و handleReady ادامه می‌دهد
      } else {
        setError(res.error ?? "خطایی رخ داد.");
      }
    });
  }

  const downloadBtn =
    "rounded-btn border border-pine/25 bg-white px-4 py-2 text-caption text-pine transition-colors hover:bg-pine/5 disabled:opacity-60";

  return (
    <div className="space-y-5">
      {status === "canceled" ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
          این قرارداد لغو شده است. برای اطلاعات بیشتر با آرکان تماس بگیرید.
        </div>
      ) : status === "accepted" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-green-200 bg-green-50 px-5 py-4">
          <div className="text-green-800">
            <p className="text-body">
              ✓ این قرارداد {doc.acceptance ? `توسط «${doc.acceptance.name}» ` : ""}تأیید شده است
              {doc.acceptance ? ` — ${faDateTime(doc.acceptance.at)}` : ""}.
            </p>
            <p className="mt-0.5 text-caption">
              {delivery === "sent"
                ? "نسخه‌ی تأییدشده برای شما ایمیل شد."
                : delivery === "sending"
                  ? "در حال ارسال نسخه‌ی تأییدشده به ایمیل شما…"
                  : "نسخه‌ی تأییدشده را از دکمه‌ی روبه‌رو دانلود کنید."}
            </p>
          </div>
          <button type="button" onClick={download} disabled={downloading} className={downloadBtn}>
            {downloading ? "در حال ساخت PDF…" : "دانلود PDF تأییدشده"}
          </button>
        </div>
      ) : (
        <div className="rounded-card border border-sand bg-white px-5 py-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-ink">لطفاً متن قرارداد را مطالعه کنید؛ در صورت موافقت، آن را آنلاین تأیید کنید.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={download} disabled={downloading} className={downloadBtn}>
                {downloading ? "در حال ساخت PDF…" : "دانلود PDF"}
              </button>
              <button
                type="button"
                onClick={() => setShowAccept((v) => !v)}
                className="rounded-btn bg-pine px-5 py-2 text-caption font-medium text-bone transition-colors hover:bg-pine-dark"
              >
                ✓ تأیید قرارداد
              </button>
            </div>
          </div>

          {showAccept && (
            <div className="mt-4 space-y-3 border-t border-sand pt-4">
              <label htmlFor="accept-name" className="block text-caption font-medium text-ink">
                نام و نام خانوادگی تأییدکننده (به‌منزله‌ی امضای آنلاین)
              </label>
              <input
                id="accept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={doc.clientName || "مثلاً نسترن قاسمی"}
                className="w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-slate/50 focus:border-brass focus:outline-none sm:max-w-xs"
              />
              <label className="flex items-start gap-2 text-caption text-ink">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                متن کامل قرارداد را خوانده‌ام و همه‌ی مفاد آن را می‌پذیرم.
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={pending || name.trim().length < 3 || !agreed}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
              >
                {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-bone/40 border-t-bone" />}
                ثبت تأیید نهایی
              </button>
              <p className="text-[0.75rem] leading-5 text-slate">
                با ثبت تأیید، نام شما، زمان و نشانی IP ثبت می‌شود و نسخه‌ی تأییدشده برای شما ایمیل می‌شود.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-caption text-red-600">
              {error}
            </p>
          )}
        </div>
      )}

      <DocViewer innerRef={sheetsRef} handleRef={viewerRef} variant="page" caption="متن کامل قرارداد">
        <ContractSheets data={doc} onReady={handleReady} />
      </DocViewer>

      <p className="pb-4 text-center text-[0.75rem] leading-6 text-slate">
        شرکت مشاوره‌ی مدیریت آرکان — مشاور استراتژی و رشد کسب‌وکار · تهران
        <br />
        این سند از طریق لینک اختصاصی و امن برای کارفرما ارسال شده است.
      </p>
    </div>
  );
}
