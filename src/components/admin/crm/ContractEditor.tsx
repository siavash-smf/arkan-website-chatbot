"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelContract,
  contractFollowupAI,
  deleteContract,
  draftContractAI,
  markContractSent,
  updateContract,
} from "@/app/admin/crm-actions";
import { formatToman, toFa } from "@/lib/utils";
import { CONTRACT_STATUS_META, type ContractWithRefs } from "@/lib/crm/types";
import { Field, Spinner, formatDate, inputClass, outlineBtnClass, primaryBtnClass } from "./ui";

/**
 * ویرایشگر قرارداد: فرم مشخصات + متن Markdown + اقدامات
 * (پیش‌نویس AI، کپی لینک کلاینت، ارسال، لغو، حذف).
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
  const [body, setBody] = useState(contract.body_md);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [followupText, setFollowupText] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [followupPending, startFollowup] = useTransition();

  const meta = CONTRACT_STATUS_META[contract.status];
  const locked = contract.status === "accepted" || !canEdit;

  function save(formData: FormData) {
    setMessage(null);
    startSave(async () => {
      const res = await updateContract(contract.id, {
        title: String(formData.get("title") ?? ""),
        body_md: body,
        amount_toman: Number(formData.get("amount_toman") ?? 0) || 0,
        start_date: String(formData.get("start_date") ?? ""),
        duration_label: String(formData.get("duration_label") ?? ""),
      });
      setMessage(res.ok ? { ok: true, text: "ذخیره شد." } : { ok: false, text: res.error ?? "خطا" });
      if (res.ok) router.refresh();
    });
  }

  function runAiDraft() {
    if (!confirm("متن فعلی با پیش‌نویس AI (بر اساس شناخت مشتری) جایگزین شود؟")) return;
    setMessage(null);
    startAi(async () => {
      const res = await draftContractAI(contract.id);
      if (res.ok) {
        setMessage({ ok: true, text: "پیش‌نویس AI جایگزین شد." });
        router.refresh();
        // متن جدید بعد از refresh از سرور می‌آید؛ state محلی هم همگام شود
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

  function send() {
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

  const mailtoHref = contract.contact?.email
    ? `mailto:${contract.contact.email}?subject=${encodeURIComponent(
        `قرارداد ${contract.contract_no} — آرکان`
      )}&body=${encodeURIComponent(
        `با سلام و احترام؛\n\nقرارداد «${contract.title}» برای بررسی و تأیید شما آماده است:\n${shareUrl}\n\nبا سپاس — شرکت مشاوره‌ی مدیریت آرکان`
      )}`
    : null;

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
            {contract.status === "accepted" &&
              contract.accepted_at &&
              ` · تأیید توسط «${contract.accepted_by_name}» در ${formatDate(contract.accepted_at)}`}
            {contract.status === "viewed" &&
              contract.viewed_at &&
              ` · دیده‌شده در ${formatDate(contract.viewed_at)}`}
          </p>
        </div>

        {/* اقدامات */}
        <div className="flex flex-wrap items-center gap-2">
          <a href={shareUrl} target="_blank" rel="noreferrer" className={outlineBtnClass}>
            پیش‌نمایش کلاینت ↗
          </a>
          <button type="button" onClick={copyLink} className={outlineBtnClass}>
            {copied ? "کپی شد ✓" : "کپی لینک"}
          </button>
          {mailtoHref && (
            <a href={mailtoHref} className={outlineBtnClass}>
              ارسال با ایمیل
            </a>
          )}
          {canEdit && contract.status === "draft" && (
            <button type="button" onClick={send} disabled={statusPending} className={primaryBtnClass}>
              {statusPending && <Spinner light />}
              ارسال به کلاینت (کپی لینک)
            </button>
          )}
          {canEdit && (contract.status === "sent" || contract.status === "viewed") && (
            <button type="button" onClick={runFollowup} disabled={followupPending} className={primaryBtnClass}>
              {followupPending && <Spinner light />}
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
                  ارسال با ایمیل
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
            message.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <form action={save} className="space-y-6">
        {/* مشخصات */}
        <section className="rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Field label="عنوان">
                <input name="title" defaultValue={contract.title} disabled={locked} className={inputClass} />
              </Field>
            </div>
            <Field label="مبلغ (تومان)">
              <input
                name="amount_toman"
                type="number"
                min={0}
                dir="ltr"
                defaultValue={contract.amount_toman || ""}
                disabled={locked}
                className={inputClass}
              />
            </Field>
            <Field label="مدت">
              <input
                name="duration_label"
                defaultValue={contract.duration_label ?? ""}
                disabled={locked}
                className={inputClass}
              />
            </Field>
            <Field label="تاریخ شروع">
              <input
                name="start_date"
                type="date"
                dir="ltr"
                defaultValue={contract.start_date ?? ""}
                disabled={locked}
                className={inputClass}
              />
            </Field>
            {contract.amount_toman > 0 && (
              <div className="flex items-end pb-2 text-caption text-slate">
                {formatToman(contract.amount_toman)}
              </div>
            )}
          </div>
        </section>

        {/* متن قرارداد */}
        <section className="rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-body font-semibold text-pine">
              متن قرارداد (Markdown)
            </h2>
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
            rows={24}
            className={`${inputClass} min-h-[400px] font-mono text-[0.85rem] leading-7`}
          />
          <p className="mt-2 text-[0.75rem] text-slate">
            {toFa(body.length)} نویسه — تیترها با «## ماده …» نوشته شوند تا در نسخه‌ی کلاینت درست رندر شود.
          </p>
        </section>

        {/* دکمه‌ها */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            {contract.status !== "accepted" && (
              <button type="submit" disabled={savePending} className={primaryBtnClass}>
                {savePending && <Spinner light />}
                ذخیره‌ی تغییرات
              </button>
            )}
            {contract.status !== "accepted" && contract.status !== "canceled" && (
              <button
                type="button"
                onClick={cancel}
                disabled={statusPending}
                className="rounded-btn border border-slate/30 px-4 py-2 text-caption text-slate transition-colors hover:bg-slate/5"
              >
                لغو قرارداد
              </button>
            )}
            <button
              type="button"
              onClick={remove}
              disabled={statusPending}
              className="rounded-btn border border-red-200 px-4 py-2 text-caption text-red-600 transition-colors hover:bg-red-50"
            >
              حذف
            </button>
          </div>
        )}
      </form>
    </>
  );
}
