"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus, type LeadStatus } from "@/app/admin/actions";
import { convertLead, scoreLeadAI, suggestContentAI } from "@/app/admin/crm-actions";
import { toFa } from "@/lib/utils";
import { FilterChip, InfoRow, formatDate } from "./crm/ui";

export type Lead = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  business_name: string;
  industry: string | null;
  stage: string;
  challenge: string;
  preferred_time: string | null;
  status: LeadStatus;
  source?: string | null;
  converted_at?: string | null;
  contact_id?: string | null;
  ai_score?: number | null;
  ai_score_rationale?: string | null;
};

function exportCsv(leads: Lead[]) {
  const headers = [
    "نام", "تلفن", "ایمیل", "کسب‌وکار", "حوزه", "مرحله", "چالش", "زمان تماس", "منبع", "وضعیت", "تاریخ",
  ];
  const rows = leads.map((l) => [
    l.full_name, l.phone, l.email ?? "", l.business_name, l.industry ?? "",
    l.stage, l.challenge, l.preferred_time ?? "", l.source ?? "website",
    l.status, new Date(l.created_at).toLocaleString("fa-IR"),
  ]);
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `arkan-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "جدید", className: "bg-brass/15 text-brass-dark" },
  contacted: { label: "تماس گرفته شد", className: "bg-pine/10 text-pine" },
  scheduled: { label: "جلسه تنظیم شد", className: "bg-blue-100 text-blue-700" },
  won: { label: "موفق", className: "bg-green-100 text-green-700" },
  lost: { label: "منصرف", className: "bg-slate/15 text-slate" },
};

const STATUS_ORDER: LeadStatus[] = ["new", "contacted", "scheduled", "won", "lost"];

export default function LeadsManager({
  leads,
  error,
}: {
  leads: Lead[];
  error: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.full_name, l.phone, l.business_name, l.industry, l.challenge]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, query, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  function changeStatus(id: string, status: LeadStatus) {
    setPendingId(id);
    startTransition(async () => {
      const res = await updateLeadStatus(id, status);
      setPendingId(null);
      if (res.ok) router.refresh();
      else alert(res.error ?? "تغییر وضعیت ناموفق بود.");
    });
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h3 font-bold text-pine">
            درخواست‌های مشاوره
          </h1>
          <p className="mt-1 text-caption text-slate">
            مجموعاً {toFa(leads.length)} درخواست ثبت شده است.
          </p>
        </div>
        {leads.length > 0 && (
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            className="shrink-0 rounded-btn border border-pine/25 px-4 py-2 text-caption text-pine transition-colors hover:bg-pine/5"
          >
            خروجی CSV
          </button>
        )}
      </div>

        {error ? (
          <div className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-body text-red-700">
            {error}
          </div>
        ) : (
          <>
            {/* فیلترها */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو در نام، تلفن، کسب‌وکار یا چالش…"
                className="w-full min-h-[44px] rounded-btn border border-slate/30 bg-white px-4 py-2.5 text-[0.95rem] text-ink transition-colors placeholder:text-slate/60 focus:border-brass focus:outline-none sm:max-w-sm"
              />
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                  label={`همه (${toFa(counts.all)})`}
                />
                {STATUS_ORDER.map((s) => (
                  <FilterChip
                    key={s}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                    label={`${STATUS_META[s].label} (${toFa(counts[s] ?? 0)})`}
                  />
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-card border border-dashed border-sand bg-white px-5 py-16 text-center text-slate">
                {leads.length === 0
                  ? "هنوز درخواستی ثبت نشده است."
                  : "نتیجه‌ای برای این جستجو/فیلتر یافت نشد."}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    pending={pendingId === lead.id}
                    onStatusChange={changeStatus}
                  />
                ))}
              </div>
            )}
          </>
        )}
    </>
  );
}

function LeadCard({
  lead,
  pending,
  onStatusChange,
}: {
  lead: Lead;
  pending: boolean;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  const router = useRouter();
  const [aiPending, startAiTransition] = useTransition();
  const [convertPending, startConvertTransition] = useTransition();
  const [contentPending, startContentTransition] = useTransition();
  const [showConvert, setShowConvert] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [contentSuggestion, setContentSuggestion] = useState<{
    message: string;
    url: string;
    title: string;
  } | null>(null);

  function runSuggestContent() {
    startContentTransition(async () => {
      const res = await suggestContentAI(lead.id);
      if (res.ok && res.message && res.url && res.title) {
        setContentSuggestion({ message: res.message, url: res.url, title: res.title });
      } else {
        alert(res.error ?? "پیشنهاد محتوا ناموفق بود.");
      }
    });
  }

  function runScore() {
    startAiTransition(async () => {
      const res = await scoreLeadAI(lead.id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "امتیازدهی ناموفق بود.");
    });
  }

  function runConvert(formData: FormData) {
    setConvertError(null);
    startConvertTransition(async () => {
      const res = await convertLead(lead.id, {
        createDeal: formData.get("create_deal") === "on",
        dealTitle: String(formData.get("deal_title") ?? ""),
        amountToman: Number(formData.get("amount_toman") ?? 0) || 0,
      });
      if (res.ok && res.id) {
        router.push(`/admin/crm/contacts/${res.id}`);
        router.refresh();
      } else {
        setConvertError(res.error ?? "تبدیل ناموفق بود.");
      }
    });
  }

  return (
    <article className="rounded-card border border-sand bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* اطلاعات اصلی */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-heading text-h3 font-semibold text-pine">
              {lead.full_name}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${STATUS_META[lead.status]?.className ?? ""}`}
            >
              {STATUS_META[lead.status]?.label ?? lead.status}
            </span>
            {typeof lead.ai_score === "number" && (
              <span
                title={lead.ai_score_rationale ?? undefined}
                className={`cursor-help rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium ${
                  lead.ai_score >= 70
                    ? "bg-green-100 text-green-700"
                    : lead.ai_score >= 40
                      ? "bg-brass/15 text-brass-dark"
                      : "bg-slate/15 text-slate"
                }`}
              >
                ✨ امتیاز: {toFa(lead.ai_score)}
              </span>
            )}
            {lead.converted_at && (
              <span className="rounded-full bg-pine/10 px-2.5 py-0.5 text-[0.8rem] font-medium text-pine">
                تبدیل‌شده
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-2">
            <InfoRow label="کسب‌وکار" value={lead.business_name} />
            <InfoRow label="حوزه" value={lead.industry} />
            <InfoRow
              label="تلفن"
              value={
                <a
                  href={`tel:${lead.phone}`}
                  dir="ltr"
                  className="text-pine underline-offset-2 hover:underline"
                >
                  {lead.phone}
                </a>
              }
            />
            <InfoRow
              label="ایمیل"
              value={
                lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    dir="ltr"
                    className="text-pine underline-offset-2 hover:underline"
                  >
                    {lead.email}
                  </a>
                ) : null
              }
            />
            <InfoRow label="مرحله" value={lead.stage} />
            <InfoRow label="زمان تماس" value={lead.preferred_time} />
          </div>

          <div className="mt-3">
            <p className="text-caption text-slate">چالش فعلی:</p>
            <p className="mt-1 text-[0.95rem] leading-7 text-ink">{lead.challenge}</p>
          </div>

          <p className="mt-3 text-caption text-slate">
            ثبت شده در {formatDate(lead.created_at)}
          </p>

          {/* اقدامات CRM: امتیازدهی AI + تبدیل به مخاطب */}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-sand pt-4">
            <button
              type="button"
              onClick={runScore}
              disabled={aiPending}
              className="inline-flex items-center gap-1.5 rounded-btn border border-pine/25 px-3.5 py-2 text-caption text-pine transition-colors hover:bg-pine/5 disabled:opacity-60"
            >
              {aiPending && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate/30 border-t-pine" />
              )}
              {typeof lead.ai_score === "number" ? "امتیازدهی مجدد با AI" : "✨ امتیازدهی با AI"}
            </button>

            <button
              type="button"
              onClick={runSuggestContent}
              disabled={contentPending}
              className="inline-flex items-center gap-1.5 rounded-btn border border-pine/25 px-3.5 py-2 text-caption text-pine transition-colors hover:bg-pine/5 disabled:opacity-60"
            >
              {contentPending && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate/30 border-t-pine" />
              )}
              📚 پیشنهاد محتوا
            </button>

            {lead.converted_at && lead.contact_id ? (
              <a
                href={`/admin/crm/contacts/${lead.contact_id}`}
                className="inline-flex items-center rounded-btn bg-pine px-3.5 py-2 text-caption font-medium text-bone transition-colors hover:bg-pine-dark"
              >
                مشاهده‌ی مخاطب ←
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setShowConvert((v) => !v)}
                className="inline-flex items-center rounded-btn bg-pine px-3.5 py-2 text-caption font-medium text-bone transition-colors hover:bg-pine-dark"
              >
                {showConvert ? "بستن" : "تبدیل به مخاطب"}
              </button>
            )}
          </div>

          {contentSuggestion && (
            <div className="mt-4 rounded-card border border-pine/20 bg-pine/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-caption font-medium text-pine">
                  📚 محتوای پیشنهادی: {contentSuggestion.title}
                </p>
                <div className="flex gap-3 text-caption">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${contentSuggestion.message}\n${contentSuggestion.url}`
                      )
                    }
                    className="text-pine underline-offset-4 hover:underline"
                  >
                    کپی پیام
                  </button>
                  <a
                    href={contentSuggestion.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-pine underline-offset-4 hover:underline"
                  >
                    دیدن پست ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => setContentSuggestion(null)}
                    className="text-slate underline-offset-4 hover:underline"
                  >
                    بستن
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-caption leading-6 text-ink">
                {contentSuggestion.message}
              </p>
            </div>
          )}

          {showConvert && !lead.converted_at && (
            <form
              action={runConvert}
              className="mt-4 rounded-card border border-brass/30 bg-brass/5 p-4"
            >
              <p className="mb-3 text-caption text-ink">
                مخاطب {lead.business_name ? `+ شرکت «${lead.business_name}»` : ""} ساخته می‌شود.
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-caption text-ink">
                <input
                  type="checkbox"
                  name="create_deal"
                  defaultChecked
                  className="h-4 w-4 accent-pine"
                />
                همزمان یک معامله در پایپ‌لاین ساخته شود
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  name="deal_title"
                  placeholder={`عنوان معامله (پیش‌فرض: مشاوره — ${lead.business_name || lead.full_name})`}
                  className="w-full min-h-[40px] rounded-btn border border-slate/30 bg-white px-3 py-2 text-caption text-ink placeholder:text-slate/60 focus:border-brass focus:outline-none"
                />
                <input
                  name="amount_toman"
                  type="number"
                  min={0}
                  dir="ltr"
                  placeholder="مبلغ تخمینی (تومان)"
                  className="w-full min-h-[40px] rounded-btn border border-slate/30 bg-white px-3 py-2 text-caption text-ink placeholder:text-slate/60 focus:border-brass focus:outline-none"
                />
              </div>
              {convertError && (
                <p role="alert" className="mt-2 text-caption text-red-600">
                  {convertError}
                </p>
              )}
              <button
                type="submit"
                disabled={convertPending}
                className="mt-3 inline-flex items-center gap-2 rounded-btn bg-pine px-4 py-2 text-caption font-medium text-bone transition-colors hover:bg-pine-dark disabled:opacity-60"
              >
                {convertPending && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bone/40 border-t-bone" />
                )}
                تأیید تبدیل
              </button>
            </form>
          )}
        </div>

        {/* تغییر وضعیت */}
        <div className="shrink-0 sm:w-44">
          <label className="mb-1.5 block text-caption font-medium text-ink">
            وضعیت
          </label>
          <div className="relative">
            <select
              value={lead.status}
              disabled={pending}
              onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
              className="w-full min-h-[44px] cursor-pointer appearance-none rounded-btn border border-slate/30 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink transition-colors focus:border-brass focus:outline-none disabled:opacity-60"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            {pending && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate/30 border-t-pine" />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

