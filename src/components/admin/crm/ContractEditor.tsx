"use client";

import { useCallback, useDeferredValue, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelContract,
  contractFollowupAI,
  deleteContract,
  draftContractAI,
  markContractSent,
  sendContractEmail,
  updateContract,
} from "@/app/admin/crm-actions";
import DocViewer, { type DocViewerHandle } from "@/components/documents/DocViewer";
import ContractSheets from "@/components/documents/ContractSheets";
import { blobToBase64, downloadBlob, renderSheetsToPdf } from "@/lib/documents/pdf";
import { formatToman, toFa } from "@/lib/utils";
import type { ContractDocData } from "@/lib/crm/contract-blocks";
import { CONTRACT_STATUS_META, type ContractWithRefs } from "@/lib/crm/types";
import { Field, Spinner, formatDate, inputClass, outlineBtnClass, primaryBtnClass } from "./ui";

/**
 * ویرایشگر قرارداد: فرم مشخصات + متن Markdown + پیش‌نمایش زنده‌ی A4 + اقدامات
 * (پیش‌نویس AI، دانلود PDF، ارسال با ایمیل، کپی لینک، لغو، حذف).
 */
export default function ContractEditor({
  contract,
  shareUrl,
  canEdit,
}: {
  contract: ContractWithRefs;
  shareUrl: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(contract.title);
  const [amount, setAmount] = useState(contract.amount_toman);
  const [duration, setDuration] = useState(contract.duration_label ?? "");
  const [startDate, setStartDate] = useState(contract.start_date ?? "");
  const [body, setBody] = useState(contract.body_md);
  const [emailNote, setEmailNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [followupText, setFollowupText] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [savePending, startSave] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [followupPending, startFollowup] = useTransition();
  const [sendPending, startSend] = useTransition();

  const sheetsRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DocViewerHandle | null>(null);

  const meta = CONTRACT_STATUS_META[contract.status];
  const locked = contract.status === "accepted" || !canEdit;
  const dirty =
    title !== contract.title ||
    amount !== contract.amount_toman ||
    duration !== (contract.duration_label ?? "") ||
    startDate !== (contract.start_date ?? "") ||
    body !== contract.body_md;
  const canSend = canEdit && !["accepted", "canceled"].includes(contract.status);

  // متن بلند با هر حرف دوباره صفحه‌بندی نشود؛ پیش‌نمایش کمی عقب‌تر از تایپ می‌آید
  const deferredBody = useDeferredValue(body);
  const docData: ContractDocData = useMemo(
    () => ({
      contractNo: contract.contract_no,
      title: title || "عنوان قرارداد",
      issuedAt: contract.created_at,
      clientName: contract.contact?.full_name ?? "کارفرما",
      companyName: contract.company?.name ?? null,
      clientEmail: contract.contact?.email ?? null,
      amountToman: amount,
      durationLabel: duration || null,
      startDate: startDate || null,
      bodyMd: deferredBody,
      acceptance:
        contract.status === "accepted" && contract.accepted_at
          ? {
              name: contract.accepted_by_name ?? "",
              at: contract.accepted_at,
              ip: contract.accepted_ip ?? null,
              code: contract.share_token.slice(0, 8),
            }
          : null,
    }),
    [contract, title, amount, duration, startDate, deferredBody]
  );

  const makePdf = useCallback(async () => {
    const root = sheetsRef.current;
    if (!root) throw new Error("پیش‌نمایش آماده نیست.");
    const capture = () => renderSheetsToPdf(root, { title: `قرارداد ${contract.contract_no}`, subject: title });
    return viewerRef.current ? viewerRef.current.atFullScale(capture) : capture();
  }, [contract.contract_no, title]);

  function save() {
    setMessage(null);
    startSave(async () => {
      const res = await updateContract(contract.id, {
        title,
        body_md: body,
        amount_toman: amount,
        start_date: startDate,
        duration_label: duration,
      });
      setMessage(res.ok ? { ok: true, text: "ذخیره شد." } : { ok: false, text: res.error ?? "خطا" });
      if (res.ok) router.refresh();
    });
  }

  async function download() {
    setDownloading(true);
    try {
      downloadBlob(await makePdf(), `${contract.contract_no}.pdf`);
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message || "ساخت PDF ناموفق بود." });
    } finally {
      setDownloading(false);
    }
  }

  function sendEmail() {
    if (!contract.contact?.email) {
      setMessage({ ok: false, text: "مخاطب این قرارداد ایمیل ندارد؛ اول ایمیل را در پرونده‌ی مخاطب ثبت کنید." });
      return;
    }
    if (!confirm(`قرارداد با PDF پیوست برای ${contract.contact.email} ایمیل شود؟`)) return;
    setMessage(null);
    startSend(async () => {
      try {
        const pdf = await blobToBase64(await makePdf());
        const res = await sendContractEmail(contract.id, pdf, emailNote);
        if (!res.ok) throw new Error(res.error ?? "ارسال ناموفق بود.");
        setEmailNote("");
        setMessage({ ok: true, text: `قرارداد برای ${contract.contact?.email} ایمیل شد.` });
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: (e as Error).message });
      }
    });
  }

  function runAiDraft() {
    if (!confirm("متن فعلی با پیش‌نویس AI (بر اساس شناخت مشتری) جایگزین شود؟")) return;
    setMessage(null);
    startAi(async () => {
      const res = await draftContractAI(contract.id);
      if (res.ok) {
        setMessage({ ok: true, text: "پیش‌نویس AI جایگزین شد." });
        // متن جدید از سرور می‌آید؛ state محلی هم باید همگام شود
        window.location.reload();
      } else {
        setMessage({ ok: false, text: res.error ?? "خطا در تولید پیش‌نویس." });
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("لینک را کپی کنید:", shareUrl);
    }
  }

  function markSentManually() {
    startStatus(async () => {
      const res = await markContractSent(contract.id);
      if (res.ok) {
        await copyLink();
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error ?? "خطا" });
      }
    });
  }

  function cancel() {
    if (!confirm("قرارداد لغو شود؟ لینک کلاینت پیام لغو نشان می‌دهد.")) return;
    startStatus(async () => {
      const res = await cancelContract(contract.id);
      if (res.ok) router.refresh();
      else setMessage({ ok: false, text: res.error ?? "خطا" });
    });
  }

  function remove() {
    if (!confirm("قرارداد به‌کلی حذف شود؟")) return;
    startStatus(async () => {
      const res = await deleteContract(contract.id);
      if (res.ok) {
        router.push("/admin/crm/contracts");
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error ?? "خطا" });
      }
    });
  }

  function runFollowup() {
    setMessage(null);
    startFollowup(async () => {
      const res = await contractFollowupAI(contract.id, shareUrl);
      if (res.ok && res.text) setFollowupText(res.text);
      else setMessage({ ok: false, text: res.error ?? "تولید پیام ناموفق بود." });
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <a
            href="/admin/crm/contracts"
            className="text-caption text-slate underline-offset-4 hover:text-pine hover:underline"
          >
            → همه‌ی قراردادها
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-h3 font-bold text-pine">{contract.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${meta.className}`}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-caption text-slate" dir="ltr">
            {contract.contract_no}
          </p>
          <p className="mt-0.5 text-caption text-slate">
            کارفرما: {contract.contact?.full_name}
            {contract.company?.name && ` — ${contract.company.name}`}
            {contract.contact?.email && ` · ${contract.contact.email}`}
            {contract.status === "accepted" &&
              contract.accepted_at &&
              ` · تأیید توسط «${contract.accepted_by_name}» در ${formatDate(contract.accepted_at)}`}
            {contract.status === "viewed" && contract.viewed_at && ` · دیده‌شده در ${formatDate(contract.viewed_at)}`}
            {contract.sent_at && contract.status !== "accepted" && ` · ارسال در ${formatDate(contract.sent_at)}`}
          </p>
          {contract.proposal_id && (
            <a
              href={`/admin/crm/proposals/${contract.proposal_id}`}
              className="mt-0.5 inline-block text-caption text-pine underline-offset-4 hover:underline"
            >
              ساخته‌شده از روی پروپوزال ↗
            </a>
          )}
        </div>

        {/* اقدامات */}
        <div className="flex flex-wrap items-center gap-2">
          <a href={shareUrl} target="_blank" rel="noreferrer" className={outlineBtnClass}>
            نسخه‌ی کلاینت ↗
          </a>
          <button type="button" onClick={copyLink} className={outlineBtnClass}>
            {copied ? "کپی شد ✓" : "کپی لینک"}
          </button>
          {canEdit && (contract.status === "sent" || contract.status === "viewed") && (
            <button type="button" onClick={runFollowup} disabled={followupPending} className={outlineBtnClass}>
              {followupPending && <Spinner />}
              ✨ پیام پیگیری با AI
            </button>
          )}
        </div>
      </div>

      {followupText && (
        <div className="mb-4 rounded-card border border-brass/40 bg-brass/5 p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-medium text-brass-dark">✨ پیام پیگیری پیشنهادی</p>
            <div className="flex gap-3 text-caption">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(followupText)}
                className="text-pine underline-offset-4 hover:underline"
              >
                کپی
              </button>
              {contract.contact?.email && (
                <a
                  href={`mailto:${contract.contact.email}?subject=${encodeURIComponent(
                    `پیگیری قرارداد ${contract.contract_no} — آرکان`
                  )}&body=${encodeURIComponent(followupText)}`}
                  className="text-pine underline-offset-4 hover:underline"
                >
                  باز کردن در برنامه‌ی ایمیل
                </a>
              )}
              <button
                type="button"
                onClick={() => setFollowupText(null)}
                className="text-slate underline-offset-4 hover:underline"
              >
                بستن
              </button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-[0.95rem] leading-7 text-ink">{followupText}</p>
        </div>
      )}

      {message && (
        <p
          role="alert"
          className={`mb-4 rounded-card border px-4 py-3 text-caption ${
            message.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          {/* مشخصات */}
          <section className="rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="عنوان">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} className={inputClass} />
                </Field>
              </div>
              <Field label="مبلغ (تومان)">
                <input
                  type="number"
                  min={0}
                  dir="ltr"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  disabled={locked}
                  className={inputClass}
                />
                {amount > 0 && <p className="mt-1 text-[0.75rem] text-slate">{formatToman(amount)}</p>}
              </Field>
              <Field label="مدت">
                <input value={duration} onChange={(e) => setDuration(e.target.value)} disabled={locked} className={inputClass} />
              </Field>
              <Field label="تاریخ شروع">
                <input
                  type="date"
                  dir="ltr"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={locked}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {/* متن قرارداد */}
          <section className="rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-body font-semibold text-pine">متن قرارداد (Markdown)</h2>
              {canEdit && contract.status !== "accepted" && (
                <button
                  type="button"
                  onClick={runAiDraft}
                  disabled={aiPending}
                  className="inline-flex items-center gap-1.5 text-caption text-pine underline-offset-4 hover:underline disabled:opacity-60"
                >
                  {aiPending && <Spinner />}
                  ✨ بازنویسی با AI (بر اساس شناخت مشتری)
                </button>
              )}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={locked}
              rows={28}
              className={`${inputClass} min-h-[400px] font-mono text-[0.85rem] leading-7`}
            />
            <p className="mt-2 text-[0.75rem] text-slate">
              {toFa(body.length)} نویسه — تیترها با «## ماده …»، فهرست‌ها با «-» و پررنگ با «**…**» نوشته شوند تا در PDF
              و نسخه‌ی کلاینت درست دیده شوند.
            </p>
          </section>

          {/* ارسال */}
          {canSend && (
            <section className="space-y-3 rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
              <h2 className="font-heading text-body font-semibold text-pine">ارسال برای کارفرما</h2>
              <Field label="یادداشت داخل ایمیل (اختیاری)">
                <textarea rows={2} value={emailNote} onChange={(e) => setEmailNote(e.target.value)} className={inputClass} />
              </Field>
              {dirty && <p className="text-caption text-amber-700">تغییرات ذخیره‌نشده دارید؛ اول ذخیره کنید تا همان نسخه ارسال شود.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={sendEmail} disabled={sendPending || dirty} className={primaryBtnClass}>
                  {sendPending && <Spinner light />}
                  {contract.status === "draft" ? "ارسال با ایمیل (PDF پیوست)" : "ارسال دوباره با ایمیل"}
                </button>
                {contract.status === "draft" && (
                  <button type="button" onClick={markSentManually} disabled={statusPending} className={outlineBtnClass}>
                    ارسال دستی (فقط کپی لینک)
                  </button>
                )}
              </div>
            </section>
          )}

          {/* دکمه‌ها */}
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && contract.status !== "accepted" && (
              <button type="button" onClick={save} disabled={savePending || !dirty} className={primaryBtnClass}>
                {savePending && <Spinner light />}
                ذخیره‌ی تغییرات
              </button>
            )}
            <button type="button" onClick={download} disabled={downloading} className={outlineBtnClass}>
              {downloading && <Spinner />}
              دانلود PDF
            </button>
            {canEdit && contract.status !== "accepted" && contract.status !== "canceled" && (
              <button
                type="button"
                onClick={cancel}
                disabled={statusPending}
                className="rounded-btn border border-slate/30 px-4 py-2 text-caption text-slate transition-colors hover:bg-slate/5"
              >
                لغو قرارداد
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={remove}
                disabled={statusPending}
                className="rounded-btn border border-red-200 px-4 py-2 text-caption text-red-600 transition-colors hover:bg-red-50"
              >
                حذف
              </button>
            )}
          </div>
        </div>

        {/* پیش‌نمایش */}
        <div className="min-w-0">
          <DocViewer innerRef={sheetsRef} handleRef={viewerRef}>
            <ContractSheets data={docData} />
          </DocViewer>
        </div>
      </div>
    </>
  );
}
