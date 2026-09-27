"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelProposal,
  convertProposalToContract,
  deleteProposal,
  reopenProposal,
  replyToProposal,
} from "@/app/admin/proposal-actions";
import { formatToman, toFa } from "@/lib/utils";
import {
  PROPOSAL_STATUS_META,
  pickOption,
  type ProposalComment,
  type ProposalRecord,
} from "@/lib/crm/proposals/types";
import { Spinner, formatDate, inputClass, outlineBtnClass, primaryBtnClass } from "./ui";

/**
 * سربرگ صفحه‌ی یک پروپوزال: وضعیت، لینک کلاینت، پاسخ و بسته‌ی انتخابی،
 * رشته‌ی گفت‌وگو با کلاینت، و اقدامات (تبدیل به قرارداد، لغو، حذف).
 */
export default function ProposalPanel({
  record,
  comments,
  shareUrl,
  canEdit,
}: {
  record: ProposalRecord;
  comments: ProposalComment[];
  shareUrl: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const meta = PROPOSAL_STATUS_META[record.status];
  const chosen = record.selected_option ? pickOption(record.options, record.selected_option) : null;
  const isOpen = !["converted", "canceled", "declined"].includes(record.status);

  function run(action: () => Promise<{ ok: boolean; error?: string; id?: string }>, onOk?: (id?: string) => void) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setMessage({ ok: false, text: res.error ?? "خطایی رخ داد." });
        return;
      }
      onOk?.(res.id);
      router.refresh();
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

  function convert() {
    const option = pickOption(record.options, record.selected_option);
    const warn =
      record.status === "approved"
        ? ""
        : "کلاینت هنوز این پیشنهاد را آنلاین تأیید نکرده است (مثلاً تلفنی تأیید کرده؟).\n";
    if (!confirm(`${warn}قرارداد بر پایه‌ی بسته‌ی «${option?.name ?? "—"}» ساخته شود؟`)) return;
    run(
      () => convertProposalToContract(record.id),
      (id) => id && router.push(`/admin/crm/contracts/${id}`)
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="/admin/crm/proposals" className="text-caption text-slate underline-offset-4 hover:text-pine hover:underline">
            → همه‌ی پروپوزال‌ها
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-h3 font-bold text-pine">{record.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${meta.className}`}>{meta.label}</span>
          </div>
          <p className="mt-1 text-caption text-slate">
            <span dir="ltr">{record.proposal_no}</span>
            {record.revision > 1 && ` · نسخه‌ی ${toFa(record.revision)}`} · {record.client_name}
            {record.client_company && ` — ${record.client_company}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {record.sent_at && (
            <>
              <a href={shareUrl} target="_blank" rel="noreferrer" className={outlineBtnClass}>
                نسخه‌ی کلاینت ↗
              </a>
              <button type="button" onClick={copyLink} className={outlineBtnClass}>
                {copied ? "کپی شد ✓" : "کپی لینک"}
              </button>
            </>
          )}
          {record.status === "converted" && record.contract_id && (
            <a href={`/admin/crm/contracts/${record.contract_id}`} className={primaryBtnClass}>
              رفتن به قرارداد
            </a>
          )}
          {canEdit && isOpen && (
            <button
              type="button"
              onClick={convert}
              disabled={pending}
              className={record.status === "approved" ? primaryBtnClass : outlineBtnClass}
            >
              {pending && <Spinner light={record.status === "approved"} />}
              تبدیل به قرارداد
            </button>
          )}
        </div>
      </div>

      {/* خلاصه‌ی وضعیت */}
      <div className="grid gap-3 rounded-card border border-sand bg-white p-5 text-caption shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-slate">ارسال</p>
          <p className="mt-0.5 text-ink">{record.sent_at ? formatDate(record.sent_at) : "هنوز ارسال نشده"}</p>
        </div>
        <div>
          <p className="text-slate">بازدید کلاینت</p>
          <p className="mt-0.5 text-ink">
            {record.view_count
              ? `${toFa(record.view_count)} بار · آخرین: ${formatDate(record.last_viewed_at ?? record.first_viewed_at ?? "")}`
              : "هنوز باز نشده"}
          </p>
        </div>
        <div>
          <p className="text-slate">پاسخ کلاینت</p>
          <p className="mt-0.5 text-ink">
            {record.responded_at
              ? `${meta.label}${record.responder_name ? ` توسط ${record.responder_name}` : ""} · ${formatDate(record.responded_at)}`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate">بسته‌ی انتخابی</p>
          <p className="mt-0.5 text-ink">{chosen ? `${chosen.name} — ${formatToman(chosen.price)}` : "—"}</p>
        </div>
      </div>

      {/* گفت‌وگو */}
      {(comments.length > 0 || (canEdit && record.sent_at)) && (
        <div className="rounded-card border border-sand bg-white p-5 shadow-soft">
          <h2 className="mb-3 font-heading text-body font-semibold text-pine">گفت‌وگو با کلاینت</h2>
          {comments.length === 0 ? (
            <p className="text-caption text-slate">کلاینت هنوز یادداشتی ننوشته است.</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-btn px-4 py-3 text-[0.9rem] leading-7 ${
                    c.author === "client" ? "bg-bone text-ink" : "bg-pine/5 text-ink"
                  }`}
                >
                  <p className="mb-1 text-[0.75rem] text-slate">
                    {c.author === "client" ? record.client_name : "آرکان"} · {formatDate(c.created_at)}
                    {c.revision > 1 && ` · نسخه‌ی ${toFa(c.revision)}`}
                  </p>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}
          {canEdit && record.sent_at && (
            <div className="mt-4 space-y-2">
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="پاسخ شما به کلاینت — در رشته ثبت و برایش ایمیل می‌شود"
                className={inputClass}
              />
              <button
                type="button"
                disabled={pending || reply.trim().length < 2}
                onClick={() => run(() => replyToProposal(record.id, reply), () => setReply(""))}
                className={outlineBtnClass}
              >
                {pending && <Spinner />}
                ارسال پاسخ
              </button>
            </div>
          )}
        </div>
      )}

      {message && (
        <p
          role="alert"
          className={`rounded-card border px-4 py-3 text-caption ${
            message.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-3 text-caption">
          {record.status === "canceled" ? (
            <button type="button" onClick={() => run(() => reopenProposal(record.id))} className="text-pine underline-offset-4 hover:underline">
              بازکردن دوباره
            </button>
          ) : (
            record.status !== "converted" && (
              <button
                type="button"
                onClick={() => confirm("پروپوزال لغو شود؟ لینک کلاینت دیگر امکان پاسخ نمی‌دهد.") && run(() => cancelProposal(record.id))}
                className="text-slate underline-offset-4 hover:underline"
              >
                لغو پروپوزال
              </button>
            )
          )}
          <button
            type="button"
            onClick={() =>
              confirm("پروپوزال به‌کلی حذف شود؟") &&
              run(
                () => deleteProposal(record.id),
                () => router.push("/admin/crm/proposals")
              )
            }
            className="text-red-600 underline-offset-4 hover:underline"
          >
            حذف
          </button>
        </div>
      )}
    </div>
  );
}
