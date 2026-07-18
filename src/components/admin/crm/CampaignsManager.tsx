"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, deleteCampaign } from "@/app/admin/crm-actions";
import { toFa } from "@/lib/utils";
import {
  EmptyBox,
  ErrorBox,
  Field,
  Spinner,
  formatDate,
  inputClass,
  outlineBtnClass,
  primaryBtnClass,
} from "./ui";

export type CampaignRow = {
  id: string;
  name: string;
  segment_key: string;
  goal: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  email_count: number;
  ready_count: number;
  sent_count: number;
};

export default function CampaignsManager({
  campaigns,
  segments,
  error,
  canEdit,
}: {
  campaigns: CampaignRow[];
  segments: Array<{ key: string; label: string; description: string }>;
  error: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitNew(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const res = await createCampaign(
        String(formData.get("name") ?? ""),
        String(formData.get("segment_key") ?? ""),
        String(formData.get("goal") ?? "")
      );
      if (res.ok && res.id) {
        router.push(`/admin/crm/campaigns/${res.id}`);
        router.refresh();
      } else {
        setFormError(res.error ?? "ساخت کمپین ناموفق بود.");
      }
    });
  }

  function remove(c: CampaignRow) {
    if (!confirm(`کمپین «${c.name}» با همه‌ی ایمیل‌هایش حذف شود؟`)) return;
    startTransition(async () => {
      const res = await deleteCampaign(c.id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "حذف ناموفق بود.");
    });
  }

  const segmentLabel = Object.fromEntries(segments.map((s) => [s.key, s.label]));

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">کمپین‌های ایمیلی</h1>
          <p className="mt-1 text-caption text-slate">
            سگمنت انتخاب کن؛ AI برای هر گیرنده ایمیل شخصی‌سازی‌شده می‌نویسد؛ بعد از بازبینی ارسال می‌کنی.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className={outlineBtnClass}>
            {showForm ? "بستن فرم" : "+ کمپین جدید"}
          </button>
        )}
      </div>

      {error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          {showForm && (
            <form
              action={submitNew}
              className="mb-6 rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="نام کمپین *">
                  <input name="name" required placeholder="مثلاً بازگشت لیدهای بهار" className={inputClass} />
                </Field>
                <Field label="سگمنت گیرندگان *">
                  <select name="segment_key" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      — انتخاب سگمنت —
                    </option>
                    {segments.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label} — {s.description}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="هدف کمپین (به AI داده می‌شود)">
                    <input
                      name="goal"
                      placeholder="مثلاً دعوت به جلسه‌ی رایگان بازبینی استراتژی پاییز"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
              {formError && (
                <p role="alert" className="mt-3 text-caption text-red-600">
                  {formError}
                </p>
              )}
              <div className="mt-4">
                <button type="submit" disabled={pending} className={primaryBtnClass}>
                  {pending && <Spinner light />}
                  ساخت کمپین و انتخاب گیرندگان
                </button>
              </div>
            </form>
          )}

          {campaigns.length === 0 ? (
            <EmptyBox message="هنوز کمپینی ساخته نشده است." />
          ) : (
            <div className="space-y-4">
              {campaigns.map((c) => (
                <article
                  key={c.id}
                  className="rounded-card border border-sand bg-white p-5 shadow-soft"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/admin/crm/campaigns/${c.id}`}
                          className="font-heading text-body font-semibold text-pine underline-offset-4 hover:underline"
                        >
                          {c.name}
                        </a>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${
                            c.status === "sent"
                              ? "bg-green-100 text-green-700"
                              : "bg-brass/15 text-brass-dark"
                          }`}
                        >
                          {c.status === "sent" ? "ارسال‌شده" : "پیش‌نویس"}
                        </span>
                      </div>
                      <p className="mt-1 text-caption text-slate">
                        سگمنت: {segmentLabel[c.segment_key] ?? c.segment_key} ·{" "}
                        {toFa(c.email_count)} گیرنده · {toFa(c.ready_count)} آماده ·{" "}
                        {toFa(c.sent_count)} ارسال‌شده
                        {c.goal && ` · هدف: ${c.goal}`}
                      </p>
                      <p className="mt-1 text-[0.75rem] text-slate">
                        {c.sent_at ? `ارسال در ${formatDate(c.sent_at)}` : `ساخت در ${formatDate(c.created_at)}`}
                      </p>
                    </div>
                    {canEdit && c.status !== "sent" && (
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        className="text-caption text-slate transition-colors hover:text-red-600"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
