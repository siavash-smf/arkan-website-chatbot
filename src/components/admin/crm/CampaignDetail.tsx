"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateCampaignEmailAI,
  sendCampaign,
  toggleCampaignEmailSkip,
  updateCampaignEmail,
} from "@/app/admin/crm-actions";
import { toFa } from "@/lib/utils";
import { ErrorBox, Spinner, inputClass, outlineBtnClass, primaryBtnClass } from "./ui";

export type CampaignEmailRow = {
  id: string;
  to_name: string;
  to_email: string;
  context: Record<string, unknown> | null;
  subject: string | null;
  body_text: string | null;
  status: string; // pending | ready | skipped | sent | failed
  error: string | null;
};

const EMAIL_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "بدون متن", className: "bg-sand text-ink" },
  ready: { label: "آماده", className: "bg-brass/15 text-brass-dark" },
  skipped: { label: "ردشده", className: "bg-slate/15 text-slate" },
  sent: { label: "ارسال‌شده", className: "bg-green-100 text-green-700" },
  failed: { label: "ناموفق", className: "bg-red-100 text-red-700" },
};

export default function CampaignDetail({
  campaign,
  emails,
  error,
  canEdit,
  resendConfigured,
}: {
  campaign: { id: string; name: string; status: string; goal: string | null };
  emails: CampaignEmailRow[];
  error: string | null;
  canEdit: boolean;
  resendConfigured: boolean;
}) {
  const router = useRouter();
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const readyCount = emails.filter((e) => e.status === "ready").length;
  const pendingCount = emails.filter((e) => e.status === "pending").length;
  const sent = campaign.status === "sent";

  function generateOne(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const res = await generateCampaignEmailAI(id);
      setPendingId(null);
      if (res.ok) router.refresh();
      else alert(res.error ?? "تولید ناموفق بود.");
    });
  }

  /** تولید همه: تک‌به‌تک صدا می‌زنیم تا هیچ درخواستی به timeout نخورد. */
  async function generateAll() {
    const targets = emails.filter((e) => e.status === "pending");
    if (!targets.length) return;
    setBulkRunning(true);
    let done = 0;
    for (const t of targets) {
      setBulkProgress(`در حال تولید ${toFa(done + 1)} از ${toFa(targets.length)} — ${t.to_name}`);
      const res = await generateCampaignEmailAI(t.id);
      if (!res.ok) {
        setMessage({ ok: false, text: `توقف روی ${t.to_name}: ${res.error}` });
        break;
      }
      done++;
    }
    setBulkRunning(false);
    setBulkProgress("");
    router.refresh();
  }

  function skip(id: string, value: boolean) {
    setPendingId(id);
    startTransition(async () => {
      await toggleCampaignEmailSkip(id, value);
      setPendingId(null);
      router.refresh();
    });
  }

  function send() {
    if (!confirm(`${toFa(readyCount)} ایمیل آماده ارسال می‌شود. ادامه می‌دهید؟`)) return;
    startTransition(async () => {
      const res = await sendCampaign(campaign.id);
      if (res.ok) {
        setMessage({
          ok: true,
          text: `ارسال انجام شد: ${toFa(res.sent ?? 0)} موفق${res.failed ? `، ${toFa(res.failed)} ناموفق` : ""}.`,
        });
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error ?? "ارسال ناموفق بود." });
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <a
            href="/admin/crm/campaigns"
            className="text-caption text-slate underline-offset-4 hover:text-pine hover:underline"
          >
            → همه‌ی کمپین‌ها
          </a>
          <h1 className="mt-1 font-heading text-h3 font-bold text-pine">{campaign.name}</h1>
          <p className="mt-1 text-caption text-slate">
            {toFa(emails.length)} گیرنده · {toFa(readyCount)} آماده · {toFa(pendingCount)} بدون متن
            {campaign.goal && ` · هدف: ${campaign.goal}`}
          </p>
        </div>
        {canEdit && !sent && (
          <div className="flex flex-wrap gap-2">
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={generateAll}
                disabled={bulkRunning}
                className={outlineBtnClass}
              >
                {bulkRunning ? <Spinner /> : "✨"} تولید همه با AI ({toFa(pendingCount)})
              </button>
            )}
            <button
              type="button"
              onClick={send}
              disabled={readyCount === 0 || bulkRunning}
              className={primaryBtnClass}
              title={resendConfigured ? "" : "RESEND_API_KEY تنظیم نشده"}
            >
              ارسال کمپین ({toFa(readyCount)})
            </button>
          </div>
        )}
      </div>

      {!resendConfigured && !sent && (
        <p className="mb-4 rounded-card border border-brass/40 bg-brass/5 px-4 py-3 text-caption text-brass-dark">
          کلید Resend تنظیم نشده — تولید و بازبینی کار می‌کند؛ برای ارسال واقعی
          <span dir="ltr" className="mx-1 font-mono">RESEND_API_KEY</span> را ست کنید یا متن‌ها را کپی/دستی بفرستید.
        </p>
      )}

      {bulkProgress && (
        <p className="mb-4 rounded-card border border-sand bg-white px-4 py-3 text-caption text-pine">
          <Spinner /> {bulkProgress}
        </p>
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

      {error ? (
        <ErrorBox message={error} />
      ) : (
        <div className="space-y-4">
          {emails.map((e) => (
            <EmailCard
              key={e.id}
              email={e}
              canEdit={canEdit && !sent}
              pending={pendingId === e.id}
              onGenerate={() => generateOne(e.id)}
              onSkip={(v) => skip(e.id, v)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function EmailCard({
  email,
  canEdit,
  pending,
  onGenerate,
  onSkip,
}: {
  email: CampaignEmailRow;
  canEdit: boolean;
  pending: boolean;
  onGenerate: () => void;
  onSkip: (skip: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(email.subject ?? "");
  const [body, setBody] = useState(email.body_text ?? "");
  const [savePending, startSave] = useTransition();

  const meta = EMAIL_STATUS[email.status] ?? EMAIL_STATUS.pending;

  function save() {
    startSave(async () => {
      const res = await updateCampaignEmail(email.id, subject, body);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        alert(res.error ?? "ذخیره ناموفق بود.");
      }
    });
  }

  async function copyText() {
    await navigator.clipboard.writeText(`موضوع: ${email.subject}\n\n${email.body_text}`);
  }

  return (
    <article
      className={`rounded-card border bg-white p-5 shadow-soft ${
        email.status === "skipped" ? "opacity-60" : ""
      } ${email.status === "failed" ? "border-red-200" : "border-sand"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{email.to_name}</span>
          <a href={`mailto:${email.to_email}`} dir="ltr" className="text-caption text-pine">
            {email.to_email}
          </a>
          <span className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${meta.className}`}>
            {meta.label}
          </span>
        </div>
        {canEdit && email.status !== "sent" && (
          <div className="flex flex-wrap items-center gap-3 text-caption">
            {email.status === "pending" && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-pine underline-offset-4 hover:underline disabled:opacity-60"
              >
                {pending && <Spinner />}✨ تولید با AI
              </button>
            )}
            {email.status === "ready" && (
              <>
                <button type="button" onClick={onGenerate} disabled={pending} className="text-pine underline-offset-4 hover:underline disabled:opacity-60">
                  {pending ? <Spinner /> : "تولید مجدد"}
                </button>
                <button type="button" onClick={() => setEditing((v) => !v)} className="text-pine underline-offset-4 hover:underline">
                  {editing ? "بستن ویرایش" : "ویرایش"}
                </button>
                <button type="button" onClick={copyText} className="text-pine underline-offset-4 hover:underline">
                  کپی متن
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onSkip(email.status !== "skipped")}
              className="text-slate underline-offset-4 hover:text-red-600 hover:underline"
            >
              {email.status === "skipped" ? "بازگرداندن" : "رد کردن"}
            </button>
          </div>
        )}
      </div>

      {email.context && (
        <p className="mt-2 text-[0.75rem] leading-5 text-slate">
          زمینه: {Object.entries(email.context).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      )}

      {email.status === "failed" && email.error && (
        <p className="mt-2 text-caption text-red-600" dir="ltr">
          {email.error}
        </p>
      )}

      {editing ? (
        <div className="mt-3 space-y-3 border-t border-sand pt-3">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع" className={inputClass} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className={inputClass} />
          <button type="button" onClick={save} disabled={savePending} className={primaryBtnClass}>
            {savePending && <Spinner light />}
            ذخیره
          </button>
        </div>
      ) : (
        email.subject && (
          <div className="mt-3 rounded-card bg-bone/70 px-4 py-3">
            <p className="text-[0.9rem] font-medium text-ink">موضوع: {email.subject}</p>
            <p className="mt-2 whitespace-pre-wrap text-caption leading-7 text-ink">{email.body_text}</p>
          </div>
        )
      )}
    </article>
  );
}
