"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToProposal } from "@/app/proposal/actions";
import DocViewer, { type DocViewerHandle } from "@/components/documents/DocViewer";
import ProposalSheets from "@/components/documents/ProposalSheets";
import { downloadBlob, renderSheetsToPdf } from "@/lib/documents/pdf";
import { faDateTime } from "@/lib/documents/format";
import { formatToman } from "@/lib/utils";
import type { ProposalComment, ProposalData, ProposalStatus } from "@/lib/crm/proposals/types";

type Mode = null | "approve" | "changes" | "decline";

const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-pine px-6 py-2.5 text-[0.95rem] font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60";
const btnOutline =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn border border-pine/25 bg-white px-5 py-2.5 text-[0.95rem] text-pine transition-colors hover:bg-pine/5 disabled:opacity-60";
const field =
  "w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-slate/50 focus:border-brass focus:outline-none";

/**
 * نمای کلاینت: سند A4، انتخاب بسته، و سه پاسخ ممکن (تأیید / نکته دارم / فعلاً نه).
 */
export default function ProposalClientView({
  token,
  data,
  status,
  selectedOption,
  responderName,
  respondedAt,
  comments,
}: {
  token: string;
  data: ProposalData;
  status: ProposalStatus;
  selectedOption: string | null;
  responderName: string | null;
  respondedAt: string | null;
  comments: ProposalComment[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(
    selectedOption ?? data.options.find((o) => o.recommended)?.id ?? data.options[0]?.id ?? ""
  );
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pending, startTransition] = useTransition();

  const sheetsRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DocViewerHandle | null>(null);

  const accepted = status === "approved" || status === "converted";
  const open = status === "sent" || status === "viewed" || status === "changes_requested";
  const chosen = data.options.find((o) => o.id === selected) ?? null;

  async function download() {
    const root = sheetsRef.current;
    if (!root) return;
    setDownloading(true);
    try {
      const capture = () => renderSheetsToPdf(root, { title: `پیشنهاد ${data.proposalNo}`, subject: data.title });
      const blob = viewerRef.current ? await viewerRef.current.atFullScale(capture) : await capture();
      downloadBlob(blob, `${data.proposalNo}.pdf`);
    } catch (e) {
      setError((e as Error).message || "ساخت PDF ناموفق بود.");
    } finally {
      setDownloading(false);
    }
  }

  function submit(action: "approve" | "changes" | "decline") {
    setError(null);
    startTransition(async () => {
      const res = await respondToProposal(token, action, { name, note, selectedOption: selected || null });
      if (!res.ok) {
        setError(res.error ?? "ثبت پاسخ ناموفق بود.");
        return;
      }
      setMode(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-h3 font-bold text-pine">{data.title}</h1>
        <p className="mt-1 text-caption text-slate">
          <span dir="ltr">{data.proposalNo}</span> · برای {data.clientName}
          {data.clientCompany ? ` — ${data.clientCompany}` : ""}
        </p>
      </div>

      {/* وضعیت */}
      {accepted ? (
        <div className="rounded-card border border-green-200 bg-green-50 px-5 py-4 text-green-800">
          <p className="font-medium">✓ این پیشنهاد تأیید شده است.</p>
          <p className="mt-1 text-caption">
            {chosen ? `بسته‌ی انتخابی: ${chosen.name} — ${formatToman(chosen.price)}` : ""}
            {responderName ? ` · توسط ${responderName}` : ""}
            {respondedAt ? ` · ${faDateTime(respondedAt)}` : ""}
          </p>
          <p className="mt-1 text-caption">قرارداد رسمی برای تأیید آنلاین برایتان ارسال می‌شود.</p>
        </div>
      ) : status === "changes_requested" ? (
        <div className="rounded-card border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
          <p className="font-medium">نکات شما ثبت شد.</p>
          <p className="mt-1 text-caption">پیشنهاد را بر اساس نظر شما بازنگری می‌کنیم و نسخه‌ی تازه را می‌فرستیم.</p>
        </div>
      ) : status === "declined" ? (
        <div className="rounded-card border border-sand bg-white px-5 py-4 text-ink">پاسخ شما ثبت شد. از وقتی که گذاشتید سپاسگزاریم.</div>
      ) : status === "canceled" ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-red-700">
          این پیشنهاد بسته شده است. برای اطلاعات بیشتر با آرکان تماس بگیرید.
        </div>
      ) : null}

      {/* سند */}
      <DocViewer innerRef={sheetsRef} handleRef={viewerRef} variant="page" caption="متن کامل پیشنهاد">
        <ProposalSheets data={data} selectedOption={accepted ? selected : null} />
      </DocViewer>

      {/* گفت‌وگو */}
      {comments.length > 0 && (
        <div className="space-y-2 rounded-card border border-sand bg-white p-5 shadow-soft">
          <p className="font-heading font-semibold text-pine">گفت‌وگو درباره‌ی این پیشنهاد</p>
          {comments.map((c) => (
            <div key={c.id} className={`rounded-btn px-4 py-3 text-[0.9rem] leading-7 ${c.author === "client" ? "bg-bone" : "bg-pine/5"}`}>
              <p className="mb-1 text-[0.75rem] text-slate">
                {c.author === "client" ? "شما" : "آرکان"} · {faDateTime(c.created_at)}
              </p>
              <p className="whitespace-pre-wrap text-ink">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* پاسخ کلاینت */}
      {open ? (
        <div className="rounded-card border border-sand bg-white p-5 shadow-soft">
          {data.options.length > 1 && (
            <>
              <p className="mb-3 font-heading font-semibold text-pine">بسته‌ی موردنظر خود را انتخاب کنید</p>
              <div className="mb-5 grid gap-2 sm:grid-cols-3">
                {data.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelected(o.id)}
                    aria-pressed={selected === o.id}
                    className={`rounded-card border p-3 text-right transition-colors ${
                      selected === o.id ? "border-pine bg-pine/5" : "border-sand hover:border-pine/30"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{o.name}</span>
                      {o.recommended && <span className="text-[0.75rem] text-pine">پیشنهاد ما</span>}
                    </span>
                    <span className="mt-1 block text-caption text-slate">{formatToman(o.price)}</span>
                    {o.durationNote && <span className="block text-[0.75rem] text-slate">{o.durationNote}</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === null ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode("approve")} className={btnPrimary}>
                ✓ این پیشنهاد را تأیید می‌کنم
              </button>
              <button type="button" onClick={() => setMode("changes")} className={btnOutline}>
                نکته یا پرسشی دارم
              </button>
              <button type="button" onClick={() => setMode("decline")} className="px-3 text-caption text-slate underline-offset-4 hover:underline">
                فعلاً ادامه نمی‌دهم
              </button>
              <button type="button" onClick={download} disabled={downloading} className={btnOutline}>
                {downloading ? "در حال ساخت PDF…" : "دانلود PDF"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {mode === "approve" ? (
                <>
                  <p className="text-caption leading-6 text-slate">
                    با تأیید این پیشنهاد
                    {chosen ? ` (بسته‌ی «${chosen.name}» — ${formatToman(chosen.price)})` : ""}، قرارداد رسمی بر همین
                    اساس برای تأیید آنلاین شما ارسال می‌شود. این تأیید خودش قرارداد نیست.
                  </p>
                  <label htmlFor="responder-name" className="block text-caption font-medium text-ink">
                    نام و نام خانوادگی
                  </label>
                  <input
                    id="responder-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={data.clientName}
                    className={`${field} sm:max-w-sm`}
                  />
                </>
              ) : (
                <p className="text-caption leading-6 text-slate">
                  {mode === "changes"
                    ? "بنویسید کدام بخش باید تغییر کند؛ دامنه‌ی کار، زمان‌بندی، مبلغ یا هر چیز دیگر. نسخه‌ی بازنگری‌شده را برایتان می‌فرستیم."
                    : "اگر مایلید بگویید چرا؛ اختیاری است و به بهتر شدن کار ما کمک می‌کند."}
                </p>
              )}
              <label htmlFor="responder-note" className="block text-caption font-medium text-ink">
                {mode === "approve" ? "یادداشت (اختیاری)" : "توضیح شما"}
              </label>
              <textarea id="responder-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => submit(mode)} disabled={pending} className={btnPrimary}>
                  {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-bone/40 border-t-bone" />}
                  {mode === "approve" ? "ثبت تأیید" : mode === "changes" ? "ارسال نکات" : "ثبت پاسخ"}
                </button>
                <button type="button" onClick={() => setMode(null)} disabled={pending} className={btnOutline}>
                  انصراف
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-caption text-red-600">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex justify-center">
          <button type="button" onClick={download} disabled={downloading} className={btnOutline}>
            {downloading ? "در حال ساخت PDF…" : "دانلود PDF پیشنهاد"}
          </button>
        </div>
      )}

      <p className="pb-4 text-center text-[0.75rem] text-slate">آرکان — مشاور استراتژی و رشد کسب‌وکار · تهران</p>
    </div>
  );
}
